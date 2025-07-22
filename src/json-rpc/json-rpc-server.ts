import { JsonRpcRequest } from './json-rpc-request.js';
import { JsonRpcError } from './json-rpc-error.js';
import { JsonRpcErrorResponse, JsonRpcResponse } from './json-rpc-response.js';
import { JSONEntry as JSONValue } from 'json-types';
import { LoggerType, TransportType } from './types.js';

export type ResponseHandler = (response: string) => unknown;
export interface JsonRpcServerOptions {
	transport?: TransportType|undefined;
	logger?: LoggerType|null|undefined;
}

export class JsonRpcServer {
	constructor(
		public handler: object,
		{
			transport,
			logger = console.error,
		}: JsonRpcServerOptions = {},
	) {
		this.transport = transport;
		this.logger = logger;
	}

	public transport?: TransportType|undefined;
	public logger: LoggerType|null;

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
				return (await method.apply(this.handler, params)) ?? null;
			} catch (e) {
				throw this.#buildUserError(e, request.id);
			}
		})();

		if ('id' in request && request.id !== undefined) {
			await this.#respondSuccess(result, request.id);
		}
	}

	#findApiMethod(request: JsonRpcRequest, subject: any = this.handler, methodName: string = ''): Function {
		// TODO Create an interface on method registration so that the user can optionally define the method parameters'
		// types and we can validate them here. Invalid argument error has error code -32602
		// Alternatively, should use JSON schema to validate the request params.

		methodName ||= request.method;

		if (!methodName.startsWith('_')) {
			if (typeof subject[methodName] === 'function') {
				return subject[methodName];
			}

			const [_fullName, firstPart, rest] = methodName.match(/^([^.]+)\.(.+)/) ?? [];

			if (!!firstPart && typeof subject[firstPart] === 'object' && subject[firstPart] !== null) {
				return this.#findApiMethod(request, subject[firstPart], rest);
			}
		}

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

	async #respondSuccess(result: any, id: string|number|null): Promise<void> {
		await this.#respond({ jsonrpc: '2.0', result, id });
	}

	async #respond(response: JsonRpcResponse): Promise<void> {
		const responseStr = (() => {
			try {
				return JSON.stringify(response);
			} catch (e) {
				throw this.#buildUserError(e, response.id);
			}
		})();
		this.transport?.(responseStr);
	}

	#buildUserError(error: unknown, id: JsonRpcRequest['id']): Error {
		const timestamp = new Date().toISOString();
		this.logger?.(`An error occured while processing a user request. ${JSON.stringify({ cause: { timestamp, id, error } })}`);
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
					} as JSONValue
					: { error: String(error) },
			},
			id: id ?? null,
		});
	}

	toStream(): TransformStream<string, string> {
		let localTransport: TransportType|undefined = undefined;
		return new TransformStream({
			start: controller => localTransport = this.transport = message => controller.enqueue(message),
			transform: chunk => this.accept(chunk),
			flush: () => {
				if (this.transport === localTransport) {
					this.transport = undefined;
				}
			},
		});
	}
}
