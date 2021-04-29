const Throw = require('../util/throw');

const PRIVATE =
{
	ATT_PUBLIC_PROTOTYPE: Symbol('#publicPrototype'),
	ATT_PRIVATE_PROTOTYPE: Symbol('#privatePrototype'),
	ATT_CONTEXTS: Symbol('#contexts'),
	ATT_DEFAULT_CONTEXT: Symbol('#defaultContext'),
	MTD_RESPOND: Symbol('#respond'),
	MTD_RESPOND_INTERNAL_ERROR: Symbol('#respondInternalError'),
	MTD_VALIDATE_MESSAGE: Symbol('#validateMessage'),
	MTD_REGISTER: Symbol('#register'),
	MTD_UNREGISTER: Symbol('#unregister'),
};

const VALID_CONTEXT_ID_TYPES = ['symbol', 'string', 'number'];

module.exports = ({ public = {}, private = {}, onresponse } = {}) =>
{
	const publicKeys = Object.keys(public);
	const privateKeys = Object.keys(private);

	// Assert public & private keys don't overlap
	publicKeys.some(key => privateKeys.includes(key))
		&& Throw('Failed to crete server. Cause: Overlap between public and private properties.');

	const unionPrototype = new Proxy({},
	{
		get(target, key)
		{
			return key in public
				? public[key]
				: private[key];
		},
	});

	return {
		[PRIVATE.ATT_PUBLIC_PROTOTYPE]: public,
		[PRIVATE.ATT_PRIVATE_PROTOTYPE]: private,
		[PRIVATE.ATT_CONTEXTS]: {},
		[PRIVATE.ATT_DEFAULT_CONTEXT]: Object.create(unionPrototype),
		onresponse: onresponse,

		register(key, value)
		{
			this[PRIVATE.MTD_REGISTER](PRIVATE.ATT_PUBLIC_PROTOTYPE, key, value);
			this[PRIVATE.MTD_UNREGISTER](PRIVATE.ATT_PRIVATE_PROTOTYPE, key);
		},
		registerPrivate(key, value)
		{
			this[PRIVATE.MTD_REGISTER](PRIVATE.ATT_PRIVATE_PROTOTYPE, key, value);
			this[PRIVATE.MTD_UNREGISTER](PRIVATE.ATT_PUBLIC_PROTOTYPE, key);
		},
		unregister(key)
		{
			this[PRIVATE.MTD_UNREGISTER](PRIVATE.ATT_PUBLIC_PROTOTYPE, key);
			this[PRIVATE.MTD_UNREGISTER](PRIVATE.ATT_PRIVATE_PROTOTYPE, key);
		},
		[PRIVATE.MTD_REGISTER](registry, key, value)
		{
			typeof key === 'function' && value === undefined
				? key.name !== ''
					? (this[registry][key.name] = key)
					: Throw("Failed to register method to rpc server. Cause: Method doesn't have a name.")
				: (this[registry][key] = value);
		},
		[PRIVATE.MTD_UNREGISTER](registry, key)
		{
			delete this[registry][key];
		},
		getProperty(key)
		{
			return this[PRIVATE.ATT_DEFAULT_CONTEXT][key];
		},
		setProperty(key, value)
		{
			this[PRIVATE.ATT_DEFAULT_CONTEXT][key] = value;
		},
		createContext(contextId = Symbol())
		{
			VALID_CONTEXT_ID_TYPES.includes(typeof contextId)
				|| Throw('Failed to create context. Cause: Invalid context id.');
			this[PRIVATE.ATT_CONTEXTS][contextId] = Object.create(unionPrototype);
			return contextId;
		},
		getContextProperty(contextId, key)
		{
			return this[PRIVATE.ATT_CONTEXTS][contextId][key];
		},
		setContextProperty(contextId, key, value)
		{
			this[PRIVATE.ATT_CONTEXTS][contextId][key] = value;
		},
		/**
		 * @param {string|JsonRpcRequest} message
		 * @param {ContextId|Context|undefined} contextOrId
		 * @returns
		 */
		async accept(message, contextOrId = undefined)
		{
			const error = this[PRIVATE.MTD_VALIDATE_MESSAGE](message);
	
			if (error)
			{
				this[PRIVATE.MTD_RESPOND](error);
				return;
			}
	
			const { method, params: args, id } = typeof message === 'string'
				? JSON.parse(message)
				: message;
	
			// Use default context if context for this request was not defined
			const actualContext = contextOrId === undefined       ? this[PRIVATE.ATT_DEFAULT_CONTEXT]
			                    : VALID_CONTEXT_ID_TYPES
			                        .includes(typeof contextOrId) ? this[PRIVATE.ATT_CONTEXTS][contextOrId]
			                    : typeof contextOrId === 'object' ? contextOrId
			                                                      : null;

			// TODO Disambiguate whether the error is because the id has invalid type or there's no context for it
			if (actualContext === null || typeof actualContext !== 'object')
			{
				this[PRIVATE.MTD_RESPOND_INTERNAL_ERROR](`Failed to accept json-rpc request. Cause: Invalid context '${contextOrId}' (${typeof contextId})`);
				return;
			}

			try
			{
				const resultOrPromise = Array.isArray(args)      ? this[PRIVATE.ATT_PUBLIC_PROTOTYPE][method].apply(actualContext, args)
				                      : typeof args === 'object' ? this[PRIVATE.ATT_PUBLIC_PROTOTYPE][method].call(actualContext, args)
				                                                 : this[PRIVATE.ATT_PUBLIC_PROTOTYPE][method].call(actualContext);
				const result = (await Promise.resolve(resultOrPromise))
					?? null;
	
				if (id !== undefined)
				{
					this[PRIVATE.MTD_RESPOND]({ jsonrpc: '2.0', result, id });
				}
			}
			catch(error)
			{
				this[PRIVATE.MTD_RESPOND](
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
		[PRIVATE.MTD_VALIDATE_MESSAGE](message)
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
			else if (typeof this[PRIVATE.ATT_PUBLIC_PROTOTYPE][method] !== 'function')
			{
				return {
					jsonrpc: '2.0',
					error:
					{
						code: -32601,
						message: `The method '${method}' does not exist / is not available.`,
						data: { method },
					},
					id: id ?? null,
				};
			}
	
			// TODO Create an interface on method registration so that the user can optionally define the method parameters'
			// types and we can validate them here. Invalid argument error has error code -32602
		
			return null;
		},
		[PRIVATE.MTD_RESPOND](response)
		{
			if (typeof response !== 'string')
			{
				response = JSON.stringify(response);
			}
	
			queueMicrotask(() => this.onresponse?.(response));
		},
		[PRIVATE.MTD_RESPOND_INTERNAL_ERROR](message)
		{
			console.error(message);
			this[PRIVATE.MTD_RESPOND](
			{
				jsonrpc: '2.0',
				error:
				{
					code: -32603,
					message: 'Internal json-rpc server error: ' + message,
				},
			});
		},
	};
};
