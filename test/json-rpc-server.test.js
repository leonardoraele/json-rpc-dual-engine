import chai from 'chai';
import JsonRpcServer from '../server.js';

const { expect } = chai;

describe('server', function()
{
	it('accepts requests', async function()
	{
		const server = JsonRpcServer();
		server.register('multiply', (a, b) => a * b);
		const responseStr = await new Promise(resolve =>
		{
			server.accept({ jsonrpc: '2.0', method: 'multiply', params: [7, 11], id: '1' });
			server.onresponse = resolve;
		});
		const responseObj = JSON.parse(responseStr);
		expect(responseObj).to.deep.equal({ jsonrpc: '2.0', result: 77, id: '1' });
	});
});
