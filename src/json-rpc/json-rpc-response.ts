import { JsonRpcRequest } from './json-rpc-request.js';

export type JsonRpcResponse = JsonRpcSuccessResponse|JsonRpcErrorResponse;

export type JsonRpcSuccessResponse = {
	jsonrpc: '2.0',
	result: unknown,
	id: string|number|null,
};

export type JsonRpcErrorResponse = {
	jsonrpc: '2.0',
	error: { code: number, message: string, data?: unknown },
	id: string|number|null,
};

export namespace JsonRpcResponse {
	export function isSuccess(response: JsonRpcResponse): response is JsonRpcSuccessResponse {
		return 'result' in response;
	}

	export function isError(response: JsonRpcResponse): response is JsonRpcErrorResponse {
		return 'error' in response;
	}

	export function is(message: JsonRpcRequest|JsonRpcResponse): message is JsonRpcResponse {
		return !JsonRpcRequest.is(message);
	}

	export function parse(message: unknown): JsonRpcResponse {
		const subject = typeof message === 'string' ? JSON.parse(message) : message;

		if (typeof subject !== 'object' || subject === null) {
			throw new Error('Failed to parse json-rpc response. Cause: The response is not an object.');
		}

		if (!('jsonrpc' in subject) || subject.jsonrpc !== '2.0') {
			throw new Error('Failed to parse json-rpc response. Cause: The response is not a json-rpc 2.0 response.');
		}

		if (!('id' in subject) || typeof subject.id !== 'string' && typeof subject.id !== 'number' && subject.id !== null) {
			throw new Error('Failed to parse json-rpc response. Cause: The response id is neither a string nor a number.');
		}

		if ('result' in subject) {
			return { jsonrpc: '2.0', result: subject.result, id: subject.id } satisfies JsonRpcSuccessResponse;
		}

		if (!('error' in subject) || typeof subject.error !== 'object' || subject.error === null) {
			throw new Error('Failed to parse json-rpc response. Cause: The response is not an error response.');
		}

		if (!('code' in subject.error) || typeof subject.error.code !== 'number') {
			throw new Error('Failed to parse json-rpc response. Cause: The error code is not a number.');
		}

		if (!('message' in subject.error) || typeof subject.error.message !== 'string') {
			throw new Error('Failed to parse json-rpc response. Cause: The error message is not a string.');
		}

		return {
			jsonrpc: '2.0',
			error: {
				code: subject.error.code,
				message: subject.error.message,
				data: 'data' in subject.error
					? subject.error.data
					: undefined,
			},
			id: subject.id
		} satisfies JsonRpcErrorResponse;
	}
}
