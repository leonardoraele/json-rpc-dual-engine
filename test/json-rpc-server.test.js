const { expect, AssertionError } = require('chai');
const sinon = require('sinon');
const JsonRpcServer = require('../server.js');

const COMPLEX_OBJECT = () => (
{
	aNumber: 99,
	aString: 'lorem ipsum',
	empty: null,
	aComplexArray: [0, '', null, {}],
	aComplexObject:
	{
		aNumber: 99,
		aString: 'lorem ipsum',
		empty: null,
		aComplexArray: [0, '', null, {}],
	},
});

describe('server', function()
{
	beforeEach(function()
	{
		this.server = JsonRpcServer();

		this.request = async message =>
		{
			const responseStr = await new Promise((resolve, reject) =>
			{
				this.server.accept(message);
				this.server.onresponse = resolve;
			});
			return JSON.parse(responseStr);
		};
	});

	describe('success scenarios', function()
	{
		it('accepts requests with positional args', async function()
		{
			this.server.register('multiply', (a, b) => a * b);
			const response = await this.request({ jsonrpc: '2.0', method: 'multiply', params: [7, 11], id: '1' });
			expect(response).to.deep.equal({ jsonrpc: '2.0', result: 77, id: '1' });
		});

		it('accepts requests with named args', async function()
		{
			this.server.register('nthWord', ({ str, idx }) => str.split(' ')[idx]);
			const response = await this.request({
				jsonrpc: '2.0',
				method: 'nthWord',
				params: { str: 'lorem ipsum dolor sit amet', idx: 1 },
				id: '1',
			});
			expect(response).to.deep.equal({ jsonrpc: '2.0', result: 'ipsum', id: '1' });
		});

		it('accepts requests with no args', async function()
		{
			this.server.register('getData', () => 'some data');
			const response = await this.request({ jsonrpc: '2.0', method: 'getData', id: '1' });
			expect(response).to.deep.equal({ jsonrpc: '2.0', result: 'some data', id: '1' });
		});

		it('accepts notifications', function(done)
		{
			const stub = sinon.stub();
			this.server.register('getData', stub);
			this.server.onresponse = () => expect.fail('Notification messages should not be responded');
			this.server.accept({ jsonrpc: '2.0', method: 'getData', params: [1, 2, 3] });
			setTimeout(
				() =>
				{
					expect(stub.calledOnce).to.be.true;
					expect(stub.lastCall.args).to.deep.equal([1, 2, 3]);
					done();
				},
				200,
			);
		});

		it('calls the correct method and returns the correct id', async function()
		{
			this.server.register('getOne', () => 1);
			this.server.register('getTwo', () => 2);
			this.server.register('getThree', () => 3);
			this.server.register('getFour', () => 4);

			expect(await this.request({ jsonrpc: '2.0', method: 'getThree', id: 12345 }))
				.to.deep.equal({ jsonrpc: '2.0', result: 3, id: 12345 });
			expect(await this.request({ jsonrpc: '2.0', method: 'getOne', id: '1' }))
				.to.deep.equal({ jsonrpc: '2.0', result: 1, id: '1' });
			expect(await this.request({ jsonrpc: '2.0', method: 'getFour', id: null }))
				.to.deep.equal({ jsonrpc: '2.0', result: 4, id: null });
			expect(await this.request({ jsonrpc: '2.0', method: 'getTwo', id: 'pipoca' }))
				.to.deep.equal({ jsonrpc: '2.0', result: 2, id: 'pipoca' });
		});
	
		it('returns null when the method handler has no result', async function()
		{
			const stub = sinon.stub().returns(undefined);
			this.server.register('foo', stub);
			const response = await this.request({ jsonrpc: '2.0', method: 'foo', params: ['bar'], id: 'example_id' });
			expect(stub.calledOnce).to.be.true;
			expect(response).to.deep.equal({ jsonrpc: '2.0', result: null, id: 'example_id' });
		});

		it('returns a complex object', async function()
		{
			this.server.register('foo', () => COMPLEX_OBJECT());
			const response = await this.request({ jsonrpc: '2.0', method: 'foo', id: 999 });
			expect(response).to.deep.equal({ jsonrpc: '2.0', result: COMPLEX_OBJECT(), id: 999 });
		});

		describe('implicit method name detection', function()
		{
			it ('function name is used when no explicit method name is passed', async function()
			{
				this.server.register(function foo() { return 'value'; });
				const response = await this.request({ jsonrpc: '2.0', method: 'foo', id: 10 });
				expect(response).to.deep.equal({ jsonrpc: '2.0', result: 'value', id: 10 });
			});

			it ('function name is NOT used when explicit method name is passed', async function()
			{
				this.server.register('foo', function bar() { return 'value'; });

				const successResponse = await this.request({ jsonrpc: '2.0', method: 'foo', id: 10 });
				expect(successResponse).to.deep.equal({ jsonrpc: '2.0', result: 'value', id: 10 });

				const errorResponse = await this.request({ jsonrpc: '2.0', method: 'bar', id: 10 });
				expect(errorResponse?.id).to.equal(10);
				expect(errorResponse?.error?.code).to.equal(-32601);
				expect(errorResponse?.result).to.equal(undefined);
			});
		});
	});

	describe('error scenarios', function()
	{
		it('fails to register unnabled methods', function()
		{
			this.server.register('foo', () => {});
			this.server.register(function bar() {});
			expect(() => this.server.register(() => {})).to.throw();
		});
		// non-'2.0' jsonrpc; non-string id or method; unnecessary fields; or invalid json message
		it('receives an invalid jsonrpc call', async function()
		{
			const PARSE_ERROR = -32700;
			const INVALID_MESSAGE = -32600;
			const validateError = async (message, code, assertMessage) =>
			{
				const response = await this.request(message);
				expect(response).to.have.property('error');
				expect(response.error.code).to.equal(code, assertMessage);
			};

			this.server.register('foo', () => {});

			await validateError('', PARSE_ERROR, 'Empty json string');
			await validateError('}{', PARSE_ERROR, 'Invalid json string');
			await validateError('"lorem ipsum"', INVALID_MESSAGE, 'Request is a string');
			await validateError('1', INVALID_MESSAGE, 'Json message is a number');
			await validateError(null, INVALID_MESSAGE, 'message is null');
			await validateError(undefined, INVALID_MESSAGE, 'message is undefined');
			await validateError({}, INVALID_MESSAGE, 'Empty request');
			await validateError({ jsonrpc: '2.0' }, INVALID_MESSAGE, 'No method field');
			await validateError({ method: 'foo', params: [], id: '1' }, INVALID_MESSAGE, 'No jsonrpc meta field');
			await validateError({ jsonrpc: '3.0', method: 'foo', params: [], id: '1' }, INVALID_MESSAGE, 'jsonrpc 3.0');
			await validateError({ jsonrpc: '2.0', method: null, params: [], id: '1' }, INVALID_MESSAGE, 'method null');
			await validateError({ jsonrpc: '2.0', method: 'foo', params: null, id: '1' }, INVALID_MESSAGE, 'null prms');
			await validateError({ jsonrpc: '2.0', method: 'foo', params: [], id: {} }, INVALID_MESSAGE, 'id is an obj');
			await validateError({ jsonrpc: '2.0', method: 'foo', params: [], id: 1.5 }, INVALID_MESSAGE, 'factor id');
		});
		it('server registered method handler throws an error', async function()
		{
			this.server.register('thrower', sinon.stub().throws());
			const response = await this.request({ jsonrpc: '2.0', method: 'thrower', id: null });
			expect(response.id).to.be.null;
			expect(response).to.have.property('error');
			expect(response.error.code).to.equal(-32000);
			expect(response.error.message).to.be.a('string');
		});
		it('receives a request for an unregistered method', async function()
		{
			this.server.register('foo', () => 'bar');
			const successResponse = await this.request({ jsonrpc: '2.0', method: 'foo', id: null });
			expect(successResponse).to.deep.equal({ jsonrpc: '2.0', result: 'bar', id: null });

			this.server.unregister('foo');
			const errorResponse = await this.request({ jsonrpc: '2.0', method: 'foo', id: null });
			expect(errorResponse.error?.code).to.equal(-32601);
			expect(errorResponse.error?.data?.method).to.equal('foo');
		});
	});

	describe('official examples', function()
	{
		it('rpc call with positional parameters', async function()
		{
			this.server.register('subtract', (a, b) => a - b);
			const response0 = await this.request({"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1});
			expect(response0).to.deep.equal({"jsonrpc": "2.0", "result": 19, "id": 1});
			const response1 = await this.request({"jsonrpc": "2.0", "method": "subtract", "params": [23, 42], "id": 2});
			expect(response1).to.deep.equal({"jsonrpc": "2.0", "result": -19, "id": 2});
		});

		it('rpc call with named parameters', async function()
		{
			this.server.register('subtract', ({ subtrahend, minuend }) => minuend - subtrahend);
			const response0 = await this.request({"jsonrpc": "2.0", "method": "subtract", "params": {"subtrahend": 23, "minuend": 42}, "id": 3});
			expect(response0).to.deep.equal({"jsonrpc": "2.0", "result": 19, "id": 3});
			const response1 = await this.request({"jsonrpc": "2.0", "method": "subtract", "params": {"minuend": 42, "subtrahend": 23}, "id": 4});
			expect(response1).to.deep.equal({"jsonrpc": "2.0", "result": 19, "id": 4});
		});

		it('a Notification', async function()
		{
			const update = sinon.stub();
			const foobar = sinon.stub();
			this.server.register('update', update);
			this.server.register('foobar', foobar);
			this.server.onresponse = () => expect.fail('Notification messages should not be responded');
			this.server.accept({"jsonrpc": "2.0", "method": "update", "params": [1,2,3,4,5]});
			this.server.accept({"jsonrpc": "2.0", "method": "foobar"});
			await new Promise(resolve => queueMicrotask(resolve));
			expect(update.lastCall?.args).to.deep.equal([1, 2, 3, 4, 5]);
			expect(foobar.lastCall?.args).to.deep.equal([]);	
		});

		it('rpc call of non-existent method', async function()
		{
			const response = await this.request({"jsonrpc": "2.0", "method": "foobar", "id": "1"});
			expect(response.jsonrpc).to.equal('2.0');
			expect(response.error.code).to.equal(-32601);
			expect(response.id).to.equal('1');
		});

		it('rpc call with invalid JSON', async function()
		{
			const response = await new Promise((resolve, reject) =>
			{
				this.server.onresponse = responseStr => resolve(JSON.parse(responseStr));
				this.server.accept('{"jsonrpc": "2.0", "method": "foobar, "params": "bar", "baz]');
			});
			expect(response?.jsonrpc).to.equal('2.0');
			expect(response?.error?.code).to.equal(-32700);
			expect(response?.id).to.equal(null);
		});

		it('rpc call with invalid Request object', async function()
		{
			const response = await this.request({"jsonrpc": "2.0", "method": 1, "params": "bar"});
			expect(response.jsonrpc).to.equal('2.0');
			expect(response.error.code).to.equal(-32600);
			expect(response.id).to.equal(null);
		});
	});
});
