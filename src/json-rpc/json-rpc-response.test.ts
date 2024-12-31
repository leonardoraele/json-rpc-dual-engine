import { expect } from 'expect';
import { JsonRpcResponse, JsonRpcSuccessResponse, JsonRpcErrorResponse } from './json-rpc-response.js';
import { describe, it } from 'node:test';

describe('JsonRpcResponse', () => {
	describe('isSuccess', () => {
		it('should return true for a success response', () => {
			const response: JsonRpcSuccessResponse = {
				jsonrpc: '2.0',
				result: 'some result',
				id: 1
			};
			expect(JsonRpcResponse.isSuccess(response)).toBe(true);
		});

		it('should return false for an error response', () => {
			const response: JsonRpcErrorResponse = {
				jsonrpc: '2.0',
				error: { code: 123, message: 'some error' },
				id: 1
			};
			expect(JsonRpcResponse.isSuccess(response)).toBe(false);
		});
	});

	describe('isError', () => {
		it('should return true for an error response', () => {
			const response: JsonRpcErrorResponse = {
				jsonrpc: '2.0',
				error: { code: 123, message: 'some error' },
				id: 1
			};
			expect(JsonRpcResponse.isError(response)).toBe(true);
		});

		it('should return false for a success response', () => {
			const response: JsonRpcSuccessResponse = {
				jsonrpc: '2.0',
				result: 'some result',
				id: 1
			};
			expect(JsonRpcResponse.isError(response)).toBe(false);
		});
	});

	describe('parse', () => {
		it('should parse a valid success response', () => {
			const message = JSON.stringify({
				jsonrpc: '2.0',
				result: 'some result',
				id: 1
			});
			const response = JsonRpcResponse.parse(message);
			expect(JsonRpcResponse.isSuccess(response)).toBe(true);
			expect(response).toEqual({
				jsonrpc: '2.0',
				result: 'some result',
				id: 1
			});
		});

		it('should parse a valid error response', () => {
			const message = JSON.stringify({
				jsonrpc: '2.0',
				error: { code: 123, message: 'some error' },
				id: 1
			});
			const response = JsonRpcResponse.parse(message);
			expect(JsonRpcResponse.isError(response)).toBe(true);
			expect(response).toEqual({
				jsonrpc: '2.0',
				error: { code: 123, message: 'some error', data: undefined },
				id: 1
			});
		});

		it('should throw an error for an invalid response', () => {
			const message = JSON.stringify({
				jsonrpc: '2.0',
				result: 'some result'
			});
			expect(() => JsonRpcResponse.parse(message)).toThrow();
		});

		it('should throw an error for a non-jsonrpc 2.0 response', () => {
			const message = JSON.stringify({
				jsonrpc: '1.0',
				result: 'some result',
				id: 1
			});
			expect(() => JsonRpcResponse.parse(message)).toThrow();
		});

		it('should throw an error for a response that is not an object', () => {
			const message = 'not an object';
			expect(() => JsonRpcResponse.parse(message)).toThrow();
		});
	});
});