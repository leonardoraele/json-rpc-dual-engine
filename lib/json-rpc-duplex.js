import JsonRpcServer from './json-rpc-server.js';
import JsonRpcClient from './json-rpc-client.js';

export default options =>
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
				? server.accept(message)
				: client.accept(message);
		},
	};
};
