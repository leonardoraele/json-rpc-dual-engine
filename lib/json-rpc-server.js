
export default ({ registry = {}, onresponse } = {}) =>
({
	__registry: registry,
	onresponse,
	register(method, handler)
	{
		this.__registry[method] = handler;
	},
	unregister(method)
	{
		delete this.__registry[method];
	},
	async accept(message)
	{
		const { method, params, id } = typeof message === 'string'
			? JSON.parse(message)
			: message;

		try
		{
			const resultOrPromise = Array.isArray(params)
				? this.__registry[method](...params)
				: this.__registry[method](params);
			const result = await Promise.resolve(resultOrPromise);
			const responseObj = { jsonrpc: '2.0', result, id };
			const responseStr = JSON.stringify(responseObj);

			this.onresponse?.(responseStr);
		}
		catch(error)
		{
			const responseObj =
			{
				jsonrpc: '2.0',
				error:
				{
					code: -32000, // Server error
					message: error.message ?? error.toString?.() ?? JSON.stringify(error),
				},
				id,
			};
			const responseStr = JSON.stringify(responseObj);

			this.onresponse?.(responseStr);
		}
	},
});
