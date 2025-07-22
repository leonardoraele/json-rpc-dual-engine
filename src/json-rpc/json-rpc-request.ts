import { JSONEntry as JSONValue } from 'json-types';
import { JsonRpcError } from './json-rpc-error.js';

export type JsonRpcRequest = {
	jsonrpc: '2.0',
	method: string,
	params?: object|unknown[]|undefined,
	id?: string|number|null|undefined,
};

export namespace JsonRpcRequest {
	const PARSED_SYMBOL = Symbol('JsonRpcRequest.PARSED');

	export function parse(subject: unknown): JsonRpcRequest {
		if (typeof subject === 'object' && subject !== null && PARSED_SYMBOL in subject) {
			return subject as any as JsonRpcRequest;
		}

		if (typeof subject === 'string') {
			try {
				subject = JSON.parse(subject);
			} catch(e) {
				throw new JsonRpcError({
					jsonrpc: '2.0',
					error: {
						code: -32700,
						message: 'Invalid JSON-RPC-2.0 request was received by the server. '
							+ 'An error occurred on the server while parsing the JSON text: '
							+ String(e),
					},
					id: null,
				});
			}
		}

		if (typeof subject !== 'object' || subject === null) {
			throw new JsonRpcError({
				jsonrpc: '2.0',
				error: {
					code: -32600,
					message: 'Server received an invalid JSON-RPC-2.0 Request object: '
						+ JSON.stringify(subject),
				},
				id: null,
			});
		}

		const jsonrpc = 'jsonrpc' in subject ? subject.jsonrpc : undefined;
		const method = 'method' in subject ? subject.method : undefined;
		const params = 'params' in subject ? subject.params : undefined;
		const id = 'id' in subject ? subject.id : undefined;

		if (jsonrpc !== '2.0') {
			throw new JsonRpcError({
				jsonrpc: '2.0',
				error: {
					code: -32600,
					message: 'Server received an invalid JSON-RPC-2.0 Request object: '
						+ 'Expected property "jsonrpc" to be "2.0", but got ' + JSON.stringify(jsonrpc),
				},
				id: null,
			});
		}

		switch (typeof id) {
			case 'string':
			case 'number':
			case 'undefined':
				break;
			// @ts-ignore (intentional switch/case fallthrough)
			case 'object':
				if (id === null) {
					break;
				}
			default:
				throw new JsonRpcError({
					jsonrpc: '2.0',
					error: {
						code: -32600,
						message: 'Server received an invalid JSON-RPC-2.0 Request object: '
							+ 'If present, property "id" must be a string, a number, or null.',
						data: { providedId: id as JSONValue },
					},
					id: null,
				});
		}

		if (typeof id === 'number' && id % 1 !== 0) {
			throw new JsonRpcError({
				jsonrpc: '2.0',
				error: {
					code: -32600,
					message: 'Server received an invalid JSON-RPC-2.0 Request object: '
						+ 'If property "id" is present and is a number, it should not contain factorial parts.',
					data: { providedId: id },
				},
				id: null,
			});
		}

		if (typeof method !== 'string') {
			throw new JsonRpcError({
				jsonrpc: '2.0',
				error: {
					code: -32600,
					message: 'Server received an invalid JSON-RPC-2.0 Request object: '
						+ 'Expected property "method" to be a string',
					data: { method } as JSONValue,
				},
				id: id ?? null,
			});
		}

		if (params !== undefined && (typeof params !== 'object' || params === null)) {
			throw new JsonRpcError({
				jsonrpc: '2.0',
				error: {
					code: -32600,
					message: 'Server received an invalid JSON-RPC-2.0 Request object: '
						+ 'If present, property "params" must be an array or an object.',
					data: { params } as JSONValue,
				},
				id: id ?? null,
			});
		}

		return markParsed({ jsonrpc, method, params, id });
	}

	function markParsed(request: JsonRpcRequest): JsonRpcRequest {
		Object.defineProperty(request, PARSED_SYMBOL, { value: true, enumerable: false });
		return request;
	}
}
