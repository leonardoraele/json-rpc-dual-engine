# json-rpc-dual-engine

## Server

```js
const JsonRpcServer = require('json-rpc-dual-engine/server');

const server = JsonRpcServer();

server.register('multiply', (a, b) => a * b);

server.onresponse = response => console.log(response);

server.accept('{"jsonrpc": "2.0", "method": "multiply", "params": [7, 11], "id": "1"}');

// Output: '{"jsonrpc": "2.0", "result": 77, "id": "1"}'
```

## Client

```js
const JsonRpcClient = require('json-rpc-dual-engine/client');

const client = JsonRpcClient();

setTimeout(100, () => client.accept('{"jsonrpc": "2.0", "result": 77, "id": "1"}'));

const result = await client.request('multiply', [7, 11]);

console.log(result); // Output: 77
```

### Using the RPC Proxy Object

```js
const JsonRpcClient = require('json-rpc-dual-engine/client');

const client = JsonRpcClient();
const rpc = client.remote;

setTimeout(100, () => client.accept('{"jsonrpc": "2.0", "result": 77, "id": "1"}'));

const result = await rpc.multiply(7, 11);

console.log(result); // Output: 77
```

## Server and Client

```js
const JsonRpcDualEngine = require('json-rpc-dual-engine');

const engine = JsonRpcDualEngine();

engine.register('multiply', (a, b) => a * b);

engine.onrequest = request => engine.accept(request);
engine.onresponse = response => engine.accept(response);

const result = await engine.request('multiply', [7, 11]);

console.log(result); // Output: 77
```

## WebSocket Example (client and server)

```js
const JsonRpcDualEngine = require('json-rpc-dual-engine');

const engine = JsonRpcDualEngine();
const websocket = await new Promise((resolve, reject) =>
{
	const websocket = new WebSocket('ws://remote.example');
	websocket.onopen = () => resolve(websocket);
	websocket.onerror = reject;
	websocket.onmessage = message => engine.accept(message.data);
});

// Register a method to handle incoming json-rpc-2.0 requests from the websocket
engine.register('ping', () => 'pong');

// Sends a json-rpc-2.0 request through the webscoket and waits until the websocket gets a response:
const result = await engine.request('multiply', [7, 11]);
```
