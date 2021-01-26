const { expect } = require('chai');
const sinon = require('sinon');
const JsonRpcServer = require('../server.js');

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
	it('sets the result to null when the handler function has no return', async function()
	{
		const server = JsonRpcServer();
		const stub = sinon.stub().returns(undefined);
		server.register('foo', stub);
		const responseStr = await new Promise(resolve =>
		{
			server.accept({ jsonrpc: '2.0', method: 'foo', params: ['bar'], id: '1' });
			server.onresponse = resolve;
		});
		const responseObj = JSON.parse(responseStr);

		expect(stub.calledOnce).to.be.true;
		expect(responseObj).to.deep.equal({ jsonrpc: '2.0', result: null, id: '1' });
	});
});
