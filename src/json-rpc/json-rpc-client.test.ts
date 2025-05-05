import { expect } from 'expect';
import { JsonRpcClient } from './json-rpc-client.js';
import { JsonRpcRequest } from './json-rpc-request.js';
import { JsonRpcResponse } from './json-rpc-response.js';
import { describe, beforeEach, it } from 'node:test';

describe(JsonRpcClient.name, () => {
	let client: JsonRpcClient;

	beforeEach(() => client = new JsonRpcClient());

	it('should build requests correctly', async () => {
		const request = client.buildRequest('testMethod', ['param1', 'param2'], { id: 99 });
		expect(request).toBe('{"jsonrpc":"2.0","id":99,"method":"testMethod","params":["param1","param2"]}');
	});

	it('should send a request and receive a response', async () => {
		client.events.on('request', (message: string) => {
			const requestObj = JsonRpcRequest.parse(message);
			expect(requestObj.method).toBe('testMethod');
			expect(requestObj.params).toEqual(['param1', 'param2']);

			queueMicrotask(() => client.accept(JSON.stringify({ jsonrpc: '2.0', id: requestObj.id, result: 'testResult' })));
		});

		await expect(client.sendRequest('testMethod', ['param1', 'param2'])).resolves.toBe('testResult');
	});

	it('should handle a notification', async () => {
		client.events.on('request', (message: string) => {
			const requestObj = JsonRpcRequest.parse(message);
			expect(requestObj.method).toBe('testNotification');
			expect(requestObj.params).toEqual(['param1', 'param2']);
		});

		await client.sendNotification('testNotification', ['param1', 'param2']);
	});

	it('should handle a response with an error', async () => {
		client.events.on('request', async (request: string) => {
			const requestObj = JsonRpcRequest.parse(request);
			expect(requestObj.method).toBe('testMethod');
			expect(requestObj.params).toBe(undefined);
			const responseObj: JsonRpcResponse = { jsonrpc: '2.0', id: requestObj.id!, error: { code: -32603, message: 'Internal error', data: 'Error data' } };

			queueMicrotask(() => client.accept(JSON.stringify(responseObj)));
		});

		try {
			await client.sendRequest('testMethod');
		} catch (error: any) {
			expect(error).toBeInstanceOf(Error);
			expect(error.cause).toEqual({ code: -32603, message: 'Internal error', data: 'Error data' });
		}
	});

	it('should handle a response with an unexpected id', t => {
		const responseObj: JsonRpcResponse = { jsonrpc: '2.0', id: 'unexpectedId', result: 'testResult' };
		const { mock } = t.mock.method(console, 'error', () => {});
		client.accept(JSON.stringify(responseObj));
		expect(mock.calls).toHaveLength(1);
	});
});
