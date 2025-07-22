import { JsonRpcRequest } from './json-rpc-request.js';
import { JsonRpcResponse } from './json-rpc-response.js';
import { nanoid } from 'nanoid';
import type { JSONMap as JSONObject, JSONEntry as JSONValue } from 'json-types';
import { BaseAPIType, LoggerType, TransportType } from './types.js';

export type RemoteAPI<APIType extends BaseAPIType> = {
	[MethodName in keyof APIType]: (...params: Parameters<APIType[MethodName]>)
		=> ReturnType<APIType[MethodName]> extends Promise<any>
			? ReturnType<APIType[MethodName]>
			: Promise<ReturnType<APIType[MethodName]>>;
};

export interface JsonRpcClientOptions {
	timeout?: number|undefined;
	transport?: TransportType|undefined;
	logger?: LoggerType|null|undefined;
}

export class JsonRpcClient<APIType extends BaseAPIType = BaseAPIType> {
	constructor({
		transport,
		timeout = 10000,
		logger = console.error,
	}: JsonRpcClientOptions = {}) {
		this.timeout = timeout;
		this.transport = transport;
		this.logger = logger;
	}

	public timeout: number;
	public transport?: TransportType|undefined;
	public logger: LoggerType|null;
	#pendingCalls: Record<string, PromiseWithResolvers<JSONValue>> = {};
	#serverProxy?: any;

	get remote(): RemoteAPI<APIType> {
		return this.#serverProxy ??= new Proxy({}, {
			get: (_target, method) => (...args: unknown[]) => {
				if (typeof method === 'symbol') {
					throw new Error('Failed to send json-rpc request. Cause: Invalid method name.', { cause: { method } });
				}
				return this.sendRequest(method, args as any);
			}
		});
	}

	buildRequest<MethodName extends keyof APIType>(method: MethodName, params?: Parameters<APIType[MethodName]>, options?: { id: string|number|null }): string;
	buildRequest(method: string, params?: JSONValue[]|JSONObject, options?: { id: string|number|null }): string;
	buildRequest(method: string, params?: JSONValue[]|JSONObject, { id = nanoid() as string|number|null } = {}): string {
		const requestObj: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
		try {
			return JSON.stringify(requestObj);
		} catch (cause) {
			throw new Error('Failed to send json-rpc request. Cause: Failed to serialize request params.', { cause });
		}
	}

	async sendRequest<MethodName extends keyof APIType>(method: MethodName, params: Parameters<APIType[MethodName]>): Promise<ReturnType<APIType[MethodName]>>;
	async sendRequest(method: string, params?: JSONValue[]|JSONObject): Promise<JSONValue>;
	async sendRequest(method: string, params?: JSONValue[]|JSONObject): Promise<JSONValue> {
		if (!this.transport) {
			return Promise.reject(new Error('Failed to send json-rpc request. Cause: No transport function provided.'));
		}
		const id = nanoid();
		const requestStr = this.buildRequest(method, params, { id });
		const { promise, reject } = this.#pendingCalls[id] = Promise.withResolvers<JSONValue>();
		const timeoutId = setTimeout(() => reject(new Error('Request timed out. (the server did not respond in time)')), this.timeout);
		this.transport(requestStr);
		return promise.finally(() => {
			clearTimeout(timeoutId);
			delete this.#pendingCalls[id];
		});
	}

	sendNotification<MethodName extends keyof APIType>(method: MethodName, params: Parameters<APIType[MethodName]>): void;
	sendNotification(method: string, params: JSONValue[]|JSONObject): void;
	sendNotification(method: string, params: JSONValue[]|JSONObject): void {
		if (!this.transport) {
			return;
		}
		const requestObj: JsonRpcRequest = { jsonrpc: '2.0', method, params };
		const requestStr = (() => {
			try {
				return JSON.stringify(requestObj);
			} catch (cause) {
				throw new Error('Failed to send json-rpc request. Cause: Failed to serialize request params.', { cause });
			}
		})();
		this.transport(requestStr);
	}

	accept(message: unknown): void {
		try {
			this.#accept(message);
		} catch (cause) {
			throw new Error('Failed to handle json-rpc response. Cause: An error occurred while processing the response.', { cause });
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
		let localTransport: TransportType|undefined = undefined;
		const writable = new WritableStream<string>({
			write: message => this.accept(message),
		});
		const readable = new ReadableStream<string>({
			start: controller => {
				localTransport = this.transport = message => controller.enqueue(message);
			},
			cancel: () => {
				if (this.transport === localTransport) {
					this.transport = undefined;
				}
			},
		});
		return { readable, writable };
	}
}
