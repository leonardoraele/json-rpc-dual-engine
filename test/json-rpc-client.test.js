const { expect } = require('chai');
const JsonRpcClient = require('../client.js');

describe('client', function()
{
	it('sends requests and accept responses', async function()
	{
		const client = JsonRpcClient();
		const requestPromise = client.request('multiply', [7, 11]);
		client.accept({ jsonrpc: '2.0', result: 77, id: '1' });
		const result = await requestPromise;
		expect(result).to.equal(77);
	});
});
