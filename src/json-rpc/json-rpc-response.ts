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
	const PARSED_SYMBOL = Symbol('JsonRpcResponse.PARSED');

	export function parse(message: unknown): JsonRpcResponse {
		const subject = typeof message === 'string' ? JSON.parse(message) as unknown : message;

		if (typeof subject === 'object' && subject !== null && PARSED_SYMBOL in subject) {
			return subject as any as JsonRpcResponse;
		}

		if (typeof subject !== 'object' || subject === null) {
			throw new Error('Failed to parse json-rpc response. Cause: The response is not an object.', { cause: { message } });
		}

		if (!('jsonrpc' in subject) || subject.jsonrpc !== '2.0') {
			throw new Error('Failed to parse json-rpc response. Cause: The response is not a json-rpc 2.0 response.', { cause: { message } });
		}

		if (!('id' in subject) || typeof subject.id !== 'string' && typeof subject.id !== 'number' && subject.id !== null) {
			throw new Error('Failed to parse json-rpc response. Cause: The response id is neither a string nor a number.', { cause: { message } });
		}

		if ('result' in subject) {
			markSuccess({ jsonrpc: '2.0', result: subject.result, id: subject.id });
		}

		if (!('error' in subject) || typeof subject.error !== 'object' || subject.error === null) {
			throw new Error('Failed to parse json-rpc response. Cause: The response is not an error response.', { cause: { message } });
		}

		if (!('code' in subject.error) || typeof subject.error.code !== 'number') {
			throw new Error('Failed to parse json-rpc response. Cause: The error code is not a number.', { cause: { message } });
		}

		if (!('message' in subject.error) || typeof subject.error.message !== 'string') {
			throw new Error('Failed to parse json-rpc response. Cause: The error message is not a string.', { cause: { message } });
		}

		return markError({
			jsonrpc: '2.0',
			error: {
				code: subject.error.code,
				message: subject.error.message,
				data: 'data' in subject.error
					? subject.error.data
					: undefined,
			},
			id: subject.id
		});
	}

	function markSuccess(response: JsonRpcResponse): typeof response {
		Object.defineProperty(response, PARSED_SYMBOL, { value: 'success', enumerable: false });
		return response;
	}

	function markError(response: JsonRpcResponse): typeof response {
		Object.defineProperty(response, PARSED_SYMBOL, { value: 'error', enumerable: false });
		return response;
	}

	export function isSuccess(response: JsonRpcResponse): response is JsonRpcSuccessResponse {
		return PARSED_SYMBOL in response
			? response[PARSED_SYMBOL] === 'success'
			: 'result' in response;
	}

	export function isError(response: JsonRpcResponse): response is JsonRpcErrorResponse {
		return PARSED_SYMBOL in response
			? response[PARSED_SYMBOL] === 'error'
			: 'error' in response;
	}
}
