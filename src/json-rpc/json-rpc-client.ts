import { SignalController } from 'signal-controller';
import { JsonRpcRequest } from './json-rpc-request.js';
import { JsonRpcResponse } from './json-rpc-response.js';
import { nanoid } from 'nanoid';
import type { JSONEntry as JSONValue } from 'json-types';

// TODO Improvde this signature
export type RemoteObject<APIType extends BaseAPIType> = {
	[MethodName in keyof APIType]: (...args: unknown[]) => Promise<APIMethodReturn<APIType, MethodName>>;
};

export type JsonRpcRequestParams = object | Array<unknown>;

export interface JsonRpcClientOptions {
	timeout?: number;
}

export interface BaseAPIType {
	[method: string]: {
		params: JsonRpcRequestParams;
		return: JSONValue;
	};
}

export type APIMethodParams<APIType extends BaseAPIType, MethodName extends keyof APIType> = APIType[MethodName]['params'];
export type APIMethodReturn<APIType extends BaseAPIType, MethodName extends keyof APIType> = APIType[MethodName]['return'];

export class JsonRpcClient<APIType extends BaseAPIType = BaseAPIType> {
	constructor({
		timeout = 10000,
	} = {} satisfies JsonRpcClientOptions) {
		this.timeout = timeout;
	}

	timeout: number;
	#pendingCalls: Record<string, PromiseWithResolvers<unknown>> = {};
	#serverProxy?: any;
	#controller = new SignalController<{
		request(message: string): void;
	}>();

	get events() {
		return this.#controller.signal;
	}

	get remote(): RemoteObject<APIType> {
		return this.#serverProxy ??= new Proxy({}, {
			get: (_target, method) => (...args: unknown[]) => {
				if (typeof method === 'symbol') {
					throw new Error('Failed to send json-rpc request. Cause: Invalid method name.', { cause: { method } });
				}
				return this.sendRequest(method, args as any);
			}
		});
	}

	buildRequest<MethodName extends keyof APIType>(method: MethodName, params?: APIMethodParams<APIType, MethodName>, options?: { id: string }): string;
	buildRequest(method: string, params?: JsonRpcRequestParams, options?: { id: string }): string;
	buildRequest(method: string, params?: JsonRpcRequestParams, { id = nanoid() } = {}): string {
		const requestObj: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
		try {
			return JSON.stringify(requestObj);
		} catch (cause) {
			throw new Error('Failed to send json-rpc request. Cause: Failed to serialize request params.', { cause });
		}
	}

	async sendRequest<MethodName extends keyof APIType>(method: MethodName, params?: APIMethodParams<APIType, MethodName>): Promise<APIMethodReturn<APIType, MethodName>>;
	async sendRequest(method: string, params?: JsonRpcRequestParams): Promise<unknown>;
	async sendRequest(method: string, params?: JsonRpcRequestParams): Promise<unknown> {
		const id = nanoid();
		const requestStr = this.buildRequest(method, params, { id });
		const resolvers = this.#pendingCalls[id] = Promise.withResolvers();
		AbortSignal.timeout(this.timeout)
			.addEventListener('abort', () =>
				resolvers.reject(new Error('Request timed out. (the server did not respond in time)'))
			);
		resolvers.promise = resolvers.promise.finally(() => delete this.#pendingCalls[id]);
		this.#controller.emit('request', requestStr);
		return resolvers.promise;
	}

	sendNotification<MethodName extends keyof APIType>(method: MethodName, params: APIMethodParams<APIType, MethodName>): void;
	sendNotification(method: string, params: unknown[]): void;
	sendNotification(method: string, params: unknown[]): void {
		const requestObj: JsonRpcRequest = { jsonrpc: '2.0', method, params };
		const requestStr = (() => {
			try {
				return JSON.stringify(requestObj);
			} catch (cause) {
				throw new Error('Failed to send json-rpc request. Cause: Failed to serialize request params.', { cause });
			}
		})();
		this.#controller.emit('request', requestStr);
	}

	accept(message: unknown): void {
		try {
			this.#accept(message);
		} catch (cause) {
			console.error(new Error('Failed to handle json-rpc response. Cause: An error occurred while processing the response.', { cause }));
		}
	}

	#accept(message: unknown): void {
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

	toStream(): ReadableWritablePair<string, string> {
		const aborter = new AbortController();
		const readable = new ReadableStream<string>({
			start: controller => {
				this.events.on('request', { signal: aborter.signal }, requestStr => controller.enqueue(requestStr));
			},
			cancel: () => aborter.abort(),
		});
		const writable = new WritableStream<string>({
			write: message => this.accept(message),
		});
		return { readable, writable };
	}
}
