import { expect } from 'expect';
import { beforeEach, describe, it, mock } from 'node:test';
import { JsonRpcServer } from './json-rpc-server.js';

describe(JsonRpcServer.name, () => {
	let server: JsonRpcServer;
	let onresponse = mock.fn((_message: string) => {});

	const getResponseRaw = () => onresponse.mock.calls.at(-1)!.arguments[0] as any;
	const getResponseParsed = () => JSON.parse(getResponseRaw());

	const TEST_API = {
		ping: () => 'pong',
		sum: (a: number, b: number) => a + b,
		hello: (name: string) => `Hello, ${name}!`,
		void: () => {},
		throws: () => { throw new Error('Test error') },
	};

	beforeEach(() => {
		server = new JsonRpcServer({ api: TEST_API, onresponse });
		onresponse.mock.resetCalls();
	});

	it('should call the correct API method and return the result', async () => {
		await server.accept({ jsonrpc: '2.0', method: 'sum', params: [1, 2], id: 1 });
		expect(getResponseParsed()).toEqual({ jsonrpc: '2.0', result: 3, id: 1 });

		await server.accept({ jsonrpc: '2.0', method: 'ping', id: 2 });
		expect(getResponseParsed()).toEqual({ jsonrpc: '2.0', result: 'pong', id: 2 });

		await server.accept({ jsonrpc: '2.0', method: 'hello', params: ['there'], id: 3 });
		expect(getResponseParsed()).toEqual({ jsonrpc: '2.0', result: 'Hello, there!', id: 3 });

		await server.accept({ jsonrpc: '2.0', method: 'void', id: 4 });
		expect(getResponseParsed()).toEqual({ jsonrpc: '2.0', result: null, id: 4 });

		await server.accept({ jsonrpc: '2.0', method: 'throws', id: 5 });
		expect(getResponseParsed()).toMatchObject({ jsonrpc: '2.0', error: {}, id: 5 });
	});

	it('should return an error if the method does not exist', async () => {
		const request = {
			jsonrpc: '2.0',
			method: 'nonExistentMethod',
			id: 1,
		};

		await server.accept(request);
		expect(getResponseParsed()).toMatchObject({ error: { code: -32601, message: expect.stringMatching(/.+/) } });
	});

	it('should handle notifications (requests without id)', async () => {
		const request = {
			jsonrpc: '2.0',
			method: 'hello',
			params: ['World'],
		};

		await server.accept(request);
		expect(onresponse.mock.calls).toHaveLength(0);
	});

	it('should handle user errors thrown by API methods', async () => {
		const request = {
			jsonrpc: '2.0',
			method: 'throws',
			id: 1,
		};

		await server.accept(request);
		expect(getResponseParsed()).toMatchObject({ error: { code: -32000, message: expect.stringMatching(/.+/), data: { message: 'Test error' } } });
	});

	it('should handle invalid JSON-RPC requests', async () => {
		const request = {
			invalid: 'request',
		};

		await server.accept(request);
		expect(getResponseParsed()).toMatchObject({ error: { code: -32600, message: expect.stringMatching(/.+/) } });
	});

	it('should work as a stream', async () => {
		const stream = server.toStream();

		stream.writable.getWriter().write(JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }));

		const result = await stream.readable.getReader().read();

		expect(result.value).toBeTruthy();

		const parsed = JSON.parse(result.value!);

		expect(parsed).toEqual({ jsonrpc: '2.0', result: 'pong', id: 1 });
	});

	it('should work as a piped stream', async () => {
		const input = new ReadableStream({
			start(controller) {
				controller.enqueue(JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }));
				controller.close();
			},
		});
		const stream = server.toStream();
		const output = new WritableStream<string>({
			start() {
				this.chunks = [];
			},
			write(chunk) {
				this.chunks.push(chunk);
			},
			close() {
				expect(this.chunks).toEqual([JSON.stringify({ jsonrpc: '2.0', result: 'pong', id: 1 })])
			},
		});

		expect.assertions(1);

		await input.pipeThrough(stream).pipeTo(output);
	});
});
