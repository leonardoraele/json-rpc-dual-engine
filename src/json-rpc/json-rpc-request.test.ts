import { expect } from 'expect';
import { JsonRpcRequest } from './json-rpc-request.js';
import { JsonRpcError } from './json-rpc-error.js';
import { describe, it } from 'node:test';

describe('JsonRpcRequest', () => {
	describe('parse', () => {
		it('should parse a valid JSON-RPC request string', () => {
			const message = JSON.stringify({
				jsonrpc: '2.0',
				method: 'testMethod',
				params: { key: 'value' },
				id: 1
			});
			const result = JsonRpcRequest.parse(message);
			expect(result).toMatchObject({
				jsonrpc: '2.0',
				method: 'testMethod',
				params: { key: 'value' },
				id: 1
			});
		});

		it('should throw an error for invalid JSON string', () => {
			const message = '{ invalid json }';
			expect(() => JsonRpcRequest.parse(message)).toThrow(JsonRpcError);
		});

		it('should throw an error for invalid JSON-RPC request object', () => {
			const message = JSON.stringify({
				jsonrpc: '1.0',
				method: 'testMethod'
			});
			expect(() => JsonRpcRequest.parse(message)).toThrow(JsonRpcError);
		});
	});

	describe('assert', () => {
		it('should not throw an error for a valid JSON-RPC request object', () => {
			const request = {
				jsonrpc: '2.0',
				method: 'testMethod',
				params: { key: 'value' },
				id: 1
			};
			expect(() => JsonRpcRequest.parse(request)).not.toThrow();
		});

		it('should throw an error for an invalid JSON-RPC request object', () => {
			const request = {
				jsonrpc: '1.0',
				method: 'testMethod'
			};
			expect(() => JsonRpcRequest.parse(request)).toThrow(JsonRpcError);
		});

		it('should throw an error if "jsonrpc" is not "2.0"', () => {
			const request = {
				jsonrpc: '1.0',
				method: 'testMethod',
				id: 1
			};
			expect(() => JsonRpcRequest.parse(request)).toThrow(JsonRpcError);
		});

		it('should throw an error if "method" is not a string', () => {
			const request = {
				jsonrpc: '2.0',
				method: 123,
				id: 1
			};
			expect(() => JsonRpcRequest.parse(request)).toThrow(JsonRpcError);
		});

		it('should throw an error if "params" is not an object or array', () => {
			const request = {
				jsonrpc: '2.0',
				method: 'testMethod',
				params: 'invalidParams',
				id: 1
			};
			expect(() => JsonRpcRequest.parse(request)).toThrow(JsonRpcError);
		});

		it('should throw an error if "id" is not a string, number, or null', () => {
			const request = {
				jsonrpc: '2.0',
				method: 'testMethod',
				id: {}
			};
			expect(() => JsonRpcRequest.parse(request)).toThrow(JsonRpcError);
		});

		it('should not throw an error if "id" is missing', () => {
			const request = {
				jsonrpc: '2.0',
				method: 'testMethod',
			};
			expect(() => JsonRpcRequest.parse(request)).not.toThrow();
		});

		it('should not throw an error if "id" is null', () => {
			const request = {
				jsonrpc: '2.0',
				method: 'testMethod',
				id: null
			};
			expect(() => JsonRpcRequest.parse(request)).not.toThrow();
		});
	});
});
