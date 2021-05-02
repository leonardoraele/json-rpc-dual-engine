const { JsonRpcDualEngine } = require('../..');
const JsonRpcClientTests = require('./json-rpc-client.test');
const JsonRpcServerTests = require('./json-rpc-server.test');

describe('dual-engine', function()
{
	describe('client', JsonRpcClientTests(JsonRpcDualEngine));
	describe('server', JsonRpcServerTests(JsonRpcDualEngine));
});
