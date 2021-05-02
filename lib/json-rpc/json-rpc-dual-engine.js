const JsonRpcServer = require('./json-rpc-server.js');
const JsonRpcClient = require('./json-rpc-client.js');

module.exports = options =>
{
	const client = JsonRpcClient(options);
	const server = JsonRpcServer(options);
	const engine =
	{
		async accept(message)
		{
			try
			{
				const { result, error } = typeof message === 'string'
					? JSON.parse(message)
					: message;
				return await result !== undefined || error !== undefined
					? (this.__proto__ = client, client.accept.apply(this, arguments))
					: (this.__proto__ = server, server.accept.apply(this, arguments));
			}
			catch(error)
			{
				// this.__proto__ = client, await client.accept.apply(this, arguments);
				return this.__proto__ = server, await server.accept.apply(this, arguments);
			}
		},
	};

	const engineProxy = new Proxy(
		engine,
		{
			get(target, key)
			{
				engine.__proto__ = key in client
					? client
					: server;
				return engine[key];
			},
		},
	);

	return engineProxy;
};
