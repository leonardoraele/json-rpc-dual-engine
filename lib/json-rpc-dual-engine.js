const JsonRpcServer = require('./json-rpc-server.js');
const JsonRpcClient = require('./json-rpc-client.js');

module.exports = options =>
{
	const client = JsonRpcClient(options);
	const server = JsonRpcServer(options);

	return {
		...client,
		...server,

		async accept(message)
		{
			const { method } = typeof message === 'string'
				? JSON.parse(message)
				: message;
			return await method
				? server.accept.call(this, message)
				: client.accept.call(this, message);
		},
	};
};
