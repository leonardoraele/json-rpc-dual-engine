import { JsonRpcRequest } from './json-rpc-request.js';
import { JsonRpcError } from './json-rpc-error.js';
import { JsonRpcErrorResponse, JsonRpcResponse } from './json-rpc-response.js';
import type { Duplex } from 'node:stream';

export type ResponseHandler = (response: string) => unknown;

export class JsonRpcServer {
	constructor(public api: object, { onresponse = undefined as ResponseHandler|undefined } = {}) {
		this.onresponse = onresponse;
	}

	onresponse: ResponseHandler|undefined;

	get #api(): any { return this.api; }

	async accept(message: unknown): Promise<void> {
		try {
			await this.#accept(message);
		} catch (e) {
			if (e instanceof JsonRpcError) {
				await this.#respond(e.response);
			} else {
				throw e;
			}
		}
	}

	async #accept(message: unknown): Promise<void> {
		const request = JsonRpcRequest.parse(message);
		const method = this.#findApiMethod(request);
		const params = request.params === undefined ? []
			: Array.isArray(request.params) ? request.params
			: [request.params];
		const result = await (async () => {
			try {
				return (await method.apply(this.api, params)) ?? null;
			} catch (e) {
				throw this.#buildUserError(e, request.id);
			}
		})();

		if (request.id) {
			await this.#respondSuccess(result, request.id);
		}
	}

	#findApiMethod(request: JsonRpcRequest): Function {
		// TODO Create an interface on method registration so that the user can optionally define the method parameters'
		// types and we can validate them here. Invalid argument error has error code -32602
		// Alternatively, should use JSON schema to validate the request params.

		if (!(request.method in this.api) || typeof this.#api[request.method] !== 'function') {
			throw new JsonRpcError({
				jsonrpc: '2.0',
				error: {
					code: -32601,
					message: `Requested method does not exist in the server.`,
					data: { method: request.method },
				},
				id: request.id ?? null,
			});
		}
		return this.#api[request.method] as Function;
	}

	async #respondSuccess(result: any, id: string|number|null): Promise<void> {
		await this.#respond({ jsonrpc: '2.0', result, id });
	}

	async #respond(response: JsonRpcResponse): Promise<void> {
		if (this.onresponse === undefined) {
			console.error('Server failed to emit json-rpc response. Cause: There is no response handler set on the server. The server is only capable of processing notification requests (method calls that don\'t expect a return).');
			return;
		}
		const responseStr = (() => {
			try {
				return JSON.stringify(response);
			} catch (e) {
				throw this.#buildUserError(e, response.id);
			}
		})();
		await this.onresponse(responseStr);
	}

	#buildUserError(error: unknown, id: JsonRpcRequest['id']): Error {
		const timestamp = new Date().toISOString();
		console.error('An error occured while processing a user request.', timestamp, 'request id:', id, 'error:', error);
		if (error instanceof JsonRpcError) {
			return error;
		}
		if (typeof error === 'object' && error !== null && 'jsonrpc' in error && error.jsonrpc === '2.0') {
			return new JsonRpcError(error as JsonRpcErrorResponse);
		}
		return new JsonRpcError({
			jsonrpc: '2.0',
			error: {
				// TODO Create an error registration interface so that the user can define specific error codes for
				// each type of error that the server can throw.
				code: -32000,
				message: 'An error occured on the server while processing the request.',
				data: error instanceof Error
					? {
						type: error.constructor.name,
						message: error.message,
						cause: error.cause,
						stack: error.stack,
					}
					: { error: String(error) },
			},
			id: id ?? null,
		});
	}

	toStream(): TransformStream<string, string> {
		return new TransformStream({
			start: (controller) => this.onresponse = message => controller.enqueue(message),
			transform: chunk => this.accept(chunk),
		});
	}

	async toNodeStream(): Promise<Duplex> {
		const { Duplex } = await import('node:stream');
		return Duplex.fromWeb(this.toStream());
	}
}
