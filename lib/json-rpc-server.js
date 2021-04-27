const PRIVATE =
{
	RESPOND: Symbol('#respond'),
	VALIDATE_MESSAGE: Symbol('#validateMessage'),
};

module.exports = ({ registry = {}, onresponse, defaultContext = {} } = {}) =>
({
	__registry: registry,
	onresponse,
	register(method, handler)
	{
		if (typeof method === 'string' && typeof handler === 'function')
		{
			this.__registry[method] = handler;
		}
		else if (typeof method === 'function' && handler === undefined && method.name !== '')
		{
			this.__registry[method.name] = method;
		}
		else
		{
			throw new Error('Failed to register method to JsonRpcServer. Cause: Invalid arguments.');
		}
	},
	unregister(method)
	{
		delete this.__registry[method];
	},
	/**
	 * @param {string|JsonRpcRequest} message
	 * @returns
	 */
	async accept(message, context = null)
	{
		const error = this[PRIVATE.VALIDATE_MESSAGE](message);

		if (error)
		{
			this[PRIVATE.RESPOND](error);
			return;
		}

		const { method, params: args, id } = typeof message === 'string'
			? JSON.parse(message)
			: message;

		// Use default context if context for this request was not defined
		const actualContext = context ?? defaultContext;

		try
		{
			const resultOrPromise = Array.isArray(args)			? this.__registry[method].apply(actualContext, args)
								  : typeof args === 'object'	? this.__registry[method].call(actualContext, args)
																: this.__registry[method].call(actualContext);
			const result = (await Promise.resolve(resultOrPromise))
				?? null;

			if (id !== undefined)
			{
				this[PRIVATE.RESPOND]({ jsonrpc: '2.0', result, id });
			}
		}
		catch(error)
		{
			this[PRIVATE.RESPOND](
			{
				jsonrpc: '2.0',
				error:
				{
					// TODO Create an error registration interface so that the user can define specific error codes for
					// each type of error that the server can throw.
					code: -32000,
					message: 'An error occured on the server while processing the request:'
						+ error.message ?? error.toString(),
					data: { stack: error.stack },
				},
				id,
			});
		}
	},
	[PRIVATE.VALIDATE_MESSAGE](message)
	{
		try
		{
			if (typeof message === 'string')
			{
				message = JSON.parse(message);
			}
		}
		catch(e)
		{
			return {
				jsonrpc: '2.0',
				error:
				{
					code: -32700,
					message: 'Invalid JSON-RPC-2.0 request was received by the server. '
						+ 'An error occurred on the server while parsing the JSON text: '
						+ e.message,
				},
				id: null,
			};
		}

		if (typeof message !== 'object' || message === null)
		{
			return {
				jsonrpc: '2.0',
				error:
				{
					code: -32600,
					message: 'Server received an invalid JSON-RPC-2.0 Request object: '
						+ JSON.stringify(message),
				},
				id: null,
			};
		}

		const { jsonrpc, method, params, id } = message;

		if (jsonrpc !== '2.0')
		{
			return {
				jsonrpc: '2.0',
				error:
				{
					code: -32600,
					message: 'Server received an invalid JSON-RPC-2.0 Request object: '
						+ 'Expected property "jsonrpc" to be "2.0", but got ' + JSON.stringify(jsonrpc),
				},
				id: null,
			};
		}
		else if (!['string', 'number', 'undefined'].includes(typeof id) && id !== null)
		{
			return {
				jsonrpc: '2.0',
				error:
				{
					code: -32600,
					message: 'Server received an invalid JSON-RPC-2.0 Request object: '
						+ 'If present, property "id" must be a string, a number, or null; but got '
						+ JSON.stringify(id),
					data: { id },
				},
				id: null,
			};
		}
		else if (typeof id === 'number' && id !== 0 && id % Math.floor(id) !== 0)
		{
			return {
				jsonrpc: '2.0',
				error:
				{
					code: -32600,
					message: 'Server received an invalid JSON-RPC-2.0 Request object: '
						+ 'If property "id" is present and is a number, it should not contain factorial parts; '
						+ 'but got ' + JSON.stringify(id),
					data: { id },
				},
				id: null,
			};
		}
		else if (typeof method !== 'string')
		{
			return {
				jsonrpc: '2.0',
				error:
				{
					code: -32600,
					message: 'Server received an invalid JSON-RPC-2.0 Request object: '
						+ 'Expected property "method" to be a string, but got ' + JSON.stringify(method),
					data: { method },
				},
				id: id ?? null,
			};
		}
		else if (params !== undefined && (typeof params !== 'object' || params === null)) // typeof null === 'object'
		{
			return {
				jsonrpc: '2.0',
				error:
				{
					code: -32600,
					message: 'Server received an invalid JSON-RPC-2.0 Request object: '
						+ 'If present, property "params" must be an array or an object, but got '
						+ JSON.stringify(params),
					data: { params },
				},
				id: id ?? null,
			};
		}
		else if (!this.__registry[method])
		{
			this[PRIVATE.RESPOND](
			{
				jsonrpc: '2.0',
				error:
				{
					code: -32601,
					message: `The method '${method}' does not exist / is not available.`,
					data: { method },
				},
				id: id ?? null,
			});
			return;
		}

		// TODO Create an interface on method registration so that the user can optionally define the method parameters'
		// types and we can validate them here.
	
		return null;
	},
	[PRIVATE.RESPOND](response)
	{
		if (typeof response !== 'string')
		{
			response = JSON.stringify(response);
		}

		queueMicrotask(() => this.onresponse?.(response));
	},
});
