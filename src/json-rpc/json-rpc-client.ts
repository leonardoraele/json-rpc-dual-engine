import { IdCounter } from '#src/util/id-counter.js';
import { JsonRpcRequest } from './json-rpc-request.js';
import { JsonRpcResponse } from './json-rpc-response.js';
import type { Writable, Readable } from 'node:stream';

export type RequestHandler = (request: string) => unknown;
export type RemoteObject<T> = {
	[K in keyof T]: T[K] extends (...args: any[]) => any
		? (...args: Parameters<T[K]>) => Promise<ReturnType<T[K]>>
		: never;
};

type PromiseFunctions = { resolve: (value: any) => void, reject: (reason: any) => void };
export type MethodInterface = Record<string, (...args: any[]) => any>;

export class JsonRpcClient<API extends MethodInterface = Record<string, any>> {
	constructor({
		timeout = 10000,
		onrequest = undefined as RequestHandler|undefined,
	} = {}) {
		this.timeout = timeout;
		this.onrequest = onrequest;
	}

	#idCounter = new IdCounter();
	timeout: number;
	onrequest: RequestHandler|undefined;
	#pendingCalls: Record<string, PromiseFunctions> = {};
	#serverProxy?: any;

	get remote(): RemoteObject<API> {
		return this.#serverProxy ??= new Proxy({}, {
			get: (_target, method) => (...args: unknown[]) => {
				if (typeof method === 'symbol') {
					throw new Error('Failed to send json-rpc request. Cause: Invalid method name.', { cause: { method } });
				}
				return this.sendRequest(method, args as any);
			}
		});
	}

	nextId(): number {
		return this.#idCounter.next();
	}

	buildRequest<M extends keyof API & string>(method: M, params?: Parameters<API[M]>, { id = this.nextId() } = {}): string {
		const requestObj: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
		try {
			return JSON.stringify(requestObj);
		} catch (cause) {
			throw new Error('Failed to send json-rpc request. Cause: Failed to serialize request params.', { cause });
		}
	}

	async sendRequest<M extends keyof API & string>(method: M, params?: Parameters<API[M]>): Promise<ReturnType<API[M]>> {
		if (this.onrequest === undefined) {
			throw new Error('Failed to send json-rpc request. Cause: No request handler set in the client.');
		}

		const id = this.nextId();
		const requestStr = this.buildRequest(method, params, { id });

		const resultPromise = new Promise((resolve, reject) => {
			this.#pendingCalls[id] = { resolve, reject };
			AbortSignal.timeout(this.timeout).addEventListener('abort', () => {
				reject(new Error('Request timed out. (the server did not respond in time)'));
			});
		}).finally(() => {
			delete this.#pendingCalls[id];
		});

		try {
			await this.onrequest(requestStr);
		} catch (e) {
			this.#pendingCalls[id]?.reject(e);
		}

		return resultPromise as Promise<ReturnType<API[M]>>;
	}

	async sendNotification(method: string, params: unknown[]): Promise<void> {
		if (this.onrequest === undefined) {
			throw new Error('Failed to send json-rpc request. Cause: No request handler set in the client.');
		}

		const requestObj: JsonRpcRequest = { jsonrpc: '2.0', method, params };
		const requestStr = (() => {
			try {
				return JSON.stringify(requestObj);
			} catch (cause) {
				throw new Error('Failed to send json-rpc request. Cause: Failed to serialize request params.', { cause });
			}
		})();

		await this.onrequest(requestStr);
	}

	accept(message: unknown): void {
		const response = JsonRpcResponse.parse(message);

		if (response.id === null || !(response.id in this.#pendingCalls)) {
			throw new Error('Failed to handle json-rpc response. Cause: Unexpected response id.', { cause: { id: response.id } });
		}

		if (JsonRpcResponse.isError(response)) {
			this.#pendingCalls[response.id]!.reject(new Error('Server returned an error response.', { cause: response.error }));
		}

		if (JsonRpcResponse.isSuccess(response)) {
			this.#pendingCalls[response.id]!.resolve(response.result);
		}
	}

	toStreamPair(): { input: WritableStream<string>, output: ReadableStream<string> } {
		const input = new WritableStream<string>({ write: message => this.accept(message) });
		const output = new ReadableStream<string>({ start: controller => this.onrequest = message => controller.enqueue(message) });
		return { input, output };
	}

	async toNodeStreamPair(): Promise<{ input: Writable, output: Readable }> {
		const { Writable, Readable } = await import('node:stream');
		const { input: webInput, output: webOutput } = this.toStreamPair();
		const input = Writable.fromWeb(webInput);
		const output = Readable.fromWeb(webOutput);
		return { input, output };
	}
}
