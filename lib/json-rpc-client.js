const idCounter = require('./id-counter.js');
const TimeoutPromise = require('./timeout-promise');

const PRIVATE =
{
	ID_COUNTER: Symbol('#idCounter'),
	PENDING_CALLS: Symbol('#pendingCalls'),
	PROXY: Symbol('#proxy'),
};

const TIMEOUT_MS = 10000; // 10 sec

module.exports = ({ timeout = TIMEOUT_MS, onrequest } = {}) =>
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
	async request(method, args)
	{
		const id = this[PRIVATE.ID_COUNTER].next();
		const requestObj = { jsonrpc: '2.0', method, params: args, id };
		const requestStr = JSON.stringify(requestObj);

		queueMicrotask(() => this.onrequest?.(requestStr));

		return await TimeoutPromise(
			timeout,
			`Call to remote method '${method}' timed out.`,
			(resolve, reject) => this[PRIVATE.PENDING_CALLS][id] = { resolve, reject },
			() => delete this[PRIVATE.PENDING_CALLS][id],
		);
	},
	notify(method, args)
	{
		const requestObj = { jsonrpc: '2.0', method, params: args };
		const requestStr = JSON.stringify(requestObj);

		queueMicrotask(() => this.onrequest?.(requestStr));
	},
	// This method is asynchronous to match server.accept in the dual engine
	async accept(message)
	{
		const { error, result, id } = typeof message === 'string'
			? JSON.parse(message)
			: message;

		if (!this[PRIVATE.PENDING_CALLS][id])
		{
			console.error?.(`Unexpected jsonrpc request response received. (request id: ${id})`);
		}
		else if (error)
		{
			this[PRIVATE.PENDING_CALLS][id].reject({ ...new Error('Remote call error.'), ...error });
		}
		else if (result)
		{
			this[PRIVATE.PENDING_CALLS][id].resolve(result);
		}
		else
		{
			console.error?.(`Invalid jsonrpc request responce received: ${message}`);
		}

		delete this[PRIVATE.PENDING_CALLS][id];
	},
});
