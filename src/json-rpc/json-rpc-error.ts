import { JsonRpcErrorResponse } from './json-rpc-response.js';

export class JsonRpcError extends Error {
	constructor(public readonly response: JsonRpcErrorResponse) {
		super(response.error.message);
	}
}
