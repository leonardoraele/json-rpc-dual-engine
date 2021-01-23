import idCounter from './id-counter.js';

const PRIVATE =
{
	ID_COUNTER: Symbol('#idCounter'),
	PENDING_CALLS: Symbol('#pendingCalls'),
	PROXY: Symbol('#proxy'),
};

export default ({ onrequest } = {}) => 
({
	[PRIVATE.ID_COUNTER]: idCounter(),
	[PRIVATE.PENDING_CALLS]: {},
	onrequest,
	get remote()
	{
		return this[PRIVATE.PROXY]
			?? (this[PRIVATE.PROXY] = new Proxy({},
			{
				get: (target, property) => async (...args) =>
				{
					return await this.request(property, args);
				},
			}));
	},
	async request(method, args, id = this[PRIVATE.ID_COUNTER].next())
	{
		const requestObj = { jsonrpc: '2.0', method, params: args, id };
		const requestStr = JSON.stringify(requestObj);
		const resultPromise = id && new Promise((resolve, reject) =>
		{
			this[PRIVATE.PENDING_CALLS][id] = { resolve, reject };
		});

		this.onrequest?.(requestStr);

		return await resultPromise;
	},
	notify(method, args)
	{
		const requestObj = { jsonrpc: '2.0', method, params: args };
		const requestStr = JSON.stringify(requestObj);

		this.onrequest?.(requestStr);
	},
	/**
	 * This method is asynchronous to make sure any previous calls have been setup properly.
	 * @param {*} message 
	 */
	async accept(message)
	{
		const { error, result, id } = typeof message === 'string'
			? JSON.parse(message)
			: message;

		error && this[PRIVATE.PENDING_CALLS][id].reject({ ...new Error('Remote call error.'), ...error });
		result && this[PRIVATE.PENDING_CALLS][id].resolve(result);
		delete this[PRIVATE.PENDING_CALLS][id];
	},
});
