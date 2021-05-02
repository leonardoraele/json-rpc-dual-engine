const { expect } = require('chai');
const sinon = require('sinon');
const JsonRpcClient = require('../../client');
const COMPLEX_OBJECT = require('./complex-object');

module.exports = JsonRpcClientTests;

describe('client', JsonRpcClientTests(JsonRpcClient));

function JsonRpcClientTests(JsonRpcClient)
{
	return function()
	{
		beforeEach(function()
		{
			this.client = JsonRpcClient({ timeout: 200 });
			this.remote = this.client.remote;
		});

		describe('success scenarios', function()
		{
			it('happiest path', async function()
			{
				queueMicrotask(() => this.client.accept({ jsonrpc: '2.0', result: 77, id: '1' }));
				expect(await this.remote.multiply(7, 11)).to.equal(77);
			});

			it('sends requests and accept responses', async function()
			{
				const requestPromise = this.client.request('multiply', [7, 11]);
				const requestStr = await new Promise(resolve => this.client.onrequest = resolve);
				expect(JSON.parse(requestStr)).to.deep.equal({ jsonrpc: '2.0', method: 'multiply', params: [7, 11], id: '1' });
				this.client.accept({ jsonrpc: '2.0', result: 77, id: '1' });
				expect(await requestPromise).to.equal(77);
			});

			it('sends requests via the remote object and accept responses', async function()
			{
				const requestPromise = this.client.remote.multiply(7, 11);
				const requestStr = await new Promise(resolve => this.client.onrequest = resolve);
				expect(JSON.parse(requestStr)).to.deep.equal({ jsonrpc: '2.0', method: 'multiply', params: [7, 11], id: '1' });
				this.client.accept({ jsonrpc: '2.0', result: 77, id: '1' });
				expect(await requestPromise).to.equal(77);
			});

			it('sends requests with named parameters', async function()
			{
				const requestPromise = this.client.request('queryData', { table: 'example', where: { id: 99 } });
				const requestStr = await new Promise(resolve => this.client.onrequest = resolve);
				expect(JSON.parse(requestStr)).to.deep.equal(
				{
					jsonrpc: '2.0',
					method: 'queryData',
					params: { table: 'example', where: { id: 99 } },
					id: '1',
				});
				this.client.accept({ jsonrpc: '2.0', result: 'some data', id: '1' });
				expect(await requestPromise).to.equal('some data');
			});

			it('omits the param property of the request if none is used', async function()
			{
				this.client.request('getData');
				const requestStr = await new Promise(resolve => this.client.onrequest = resolve);
				expect(JSON.parse(requestStr)).to.deep.equal({ jsonrpc: '2.0', method: 'getData', id: '1' });
			});

			it('accepts object response results', async function()
			{
				const requestPromise = this.client.request('getData');
				this.client.accept({ jsonrpc: '2.0', result: COMPLEX_OBJECT(), id: '1' });
				expect(await requestPromise).to.deep.equal(COMPLEX_OBJECT());
			});

			it('accepts null response results', async function()
			{
				const resultPromise = this.client.request('getData');
				await this.client.accept({ jsonrpc: '2.0', result: null, id: '1' });
				expect(await resultPromise).to.be.null;
			});

			it('makes requests with increasing id', async function()
			{
				for (let id = 1; id <= 3; id++)
				{
					this.client.request('multiply', [0, 0]);
					const requestStr = await new Promise(resolve => this.client.onrequest = resolve)
					expect(JSON.parse(requestStr).id).to.equal(''+id);
				}
			});

			it('makes notification requests without a return promise and id param', async function()
			{
				const notification = this.client.notify('somethingHappened', [1, 2, 3, 4]);
				expect(notification).to.be.undefined;
				const requestStr = await new Promise(resolve => this.client.onrequest = resolve);
				expect(JSON.parse(requestStr)).to.deep.equal({ jsonrpc: '2.0', method: 'somethingHappened', params: [1, 2, 3, 4] });
			});

			it('accepts responses in a different order of which the requests were made', async function()
			{
				const resolvedRequests = [];
				const nextTick = () => new Promise(resolve => queueMicrotask(resolve));

				this.client.request('multiply', [7, 11]) // request #1
					.then(result =>
					{
						expect(result).to.equal(77);
						resolvedRequests.push(1);
					});
				this.client.request('multiply', [2, 13]) // request #2
					.then(result =>
					{
						expect(result).to.equal(26);
						resolvedRequests.push(2);
					});
				this.client.request('multiply', [5, 9]) // request #3
					.then(result =>
					{
						expect(result).to.equal(45);
						resolvedRequests.push(3);
					});

				await this.client.accept({ jsonrpc: '2.0', result: 26, id: '2' });
				await nextTick();

				expect(resolvedRequests).to.deep.equal([2]);

				await this.client.accept({ jsonrpc: '2.0', result: 45, id: '3' });
				await nextTick();

				expect(resolvedRequests).to.deep.equal([2, 3]);

				await this.client.accept({ jsonrpc: '2.0', result: 77, id: '1' });
				await nextTick();

				expect(resolvedRequests).to.deep.equal([2, 3, 1]);
			});
		});

		describe('error scenarios', function()
		{
			it('receives a json-rpc error response', async function()
			{
				const resultPromise = this.client.request('multiply', [7, 11]);
				this.client.accept({ jsonrpc: '2.0', error: { code: 12345, message: 'some error happened' }, id: '1' });

				try
				{
					await resultPromise;
					expect.fail('The request promise should be rejected when a jsonrpc error occurs.');
				}
				catch (error)
				{
					expect(error.code).to.equal(12345);
					expect(error.message).to.equal('some error happened');
					expect(error.data).to.be.undefined;
				}
			});

			it('receives json-rpc error response with additional data', async function()
			{
				const resultPromise = this.client.request('multiply', [7, 11]);
				this.client.accept({ jsonrpc: '2.0', error: { code: 0, message: '', data: COMPLEX_OBJECT() }, id: '1' });

				try
				{
					await resultPromise;
					expect.fail('The request promise should be rejected when a jsonrpc error occurs.');
				}
				catch (error)
				{
					expect(error.data).to.deep.equal(COMPLEX_OBJECT());
				}
			});

			it('times out the response promise after a period', async function()
			{
				try
				{
					await this.client.request('multiply', [7, 11]);
					expect.fail('The request promise should be rejected by timeout since no response was received.');
				}
				catch(e) {}
			});

			it('receives an unexpected response', async function()
			{
				const spy = sinon.spy(console, 'error');
				this.client.request('multiply', [7, 11]);
				await this.client.accept({ jsonrpc: '2.0', result: 77, id: '2' });
				expect(spy.calledOnce).to.be.true;
				spy.restore();
			});

			describe('receives an invalid response', function()
			{
				it('receives a non-2.0 json-rpc response'); // i.e. typeof response !== 'object' || response.jsonrpc !== '2.0'
				it('receives a response with an invalid or absence "result" field'); // invalid being non-string or null
				it('receives a response with an invalid or absence "id" field'); // invalid being non-string; null is valid in some error cases
				it('receives a response with unnecessary fields'); // i.e. fields other than jsonrpc, result, id, error, error.code, error.message, and error.data
				it('receives a invalid json response');
				it('receives a response that is not a js object or string');
			});

			describe('rejects repeaded responses received from the server', function()
			{
				it('receives a valid response and ignores other responses');
				it('receives an error response and ignores other responses');
			});
		});
	};
}
