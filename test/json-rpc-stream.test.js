import chai from 'chai';
import JsonRpcClient from '../client.js';
import JsonRpcServer from '../server.js';
import JsonRpcStream from '../stream.js';
import stream from 'stream';

const { expect } = chai;

describe('stream', function()
{
	it('has an accessible `engine` property', function()
	{
		expect(JsonRpcStream()).to.have.property('engine');
	});
	it('handles remote method calls', function(done)
	{
		const stream = JsonRpcStream();
		stream.engine.register('ping', () => 'pong');
		stream.write(JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: '1' }));
		stream.on('data', data =>
		{
			const responseObj = JSON.parse(data.toString());
			expect(responseObj.result).to.be.string('pong');
			done();
		});
	});
	it('sends remote method calls', async function()
	{
		const stream = JsonRpcStream();
		const resultPromise = stream.engine.request('ping');
		stream.write(JSON.stringify({ jsonrpc: '2.0', result: 'pong', id: '1' }));
		const result = await resultPromise;
		expect(result).to.be.string('pong');
	});
	it('allows communication between a client and a server', async function()
	{
		const server = JsonRpcStream(JsonRpcServer());
		const client = JsonRpcStream(JsonRpcClient());

		stream.pipeline(server, client, server, () => { throw new Error('Pipeline broke'); });

		server.engine.register('multiply', (a, b) => a * b);
		const result = await client.engine.request('multiply', [7, 11]);
		expect(result).to.equal(77);
	});
});
