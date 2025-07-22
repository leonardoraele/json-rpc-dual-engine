import { JsonRpcClient, BaseAPIType, JsonRpcClientOptions } from './json-rpc-client.js';
import { JsonRpcRequest } from './json-rpc-request.js';
import { JsonRpcResponse } from './json-rpc-response.js';
import { JsonRpcServer, JsonRpcServerOptions } from './json-rpc-server.js';

export class JsonRpcDualEngine<LocalAPIType extends BaseAPIType, RemoteAPIType extends BaseAPIType = BaseAPIType> {
	constructor(handler: LocalAPIType, options?: JsonRpcServerOptions & JsonRpcClientOptions) {
		this.server = new JsonRpcServer(handler, options);
		this.client = new JsonRpcClient(options);
	}

	readonly server: JsonRpcServer<LocalAPIType>;
	readonly client: JsonRpcClient<RemoteAPIType>;

	get transport(): JsonRpcClient['transport'] & JsonRpcServer<any>['transport'] {
		return this.client.transport || this.server.transport;
	}

	set transport(transport: JsonRpcClient['transport'] & JsonRpcServer<any>['transport']) {
		this.client.transport = this.server.transport = transport;
	}

	async accept(message: unknown): Promise<void> {
		try {
			await this.#accept(message);
		} catch (cause) {
			throw new Error('Failed to accept json-rpc message.', { cause });
		}
	}

	async #accept(message: unknown): Promise<void> {
		const object = typeof message === 'string' ? JSON.parse(message) as unknown : message;
		const parsed = (() => {
			try {
				return JsonRpcRequest.parse(object);
			} catch(requestError) {
				try {
					return JsonRpcResponse.parse(object);
				} catch (responseError) {
					throw new Error('Failed to parse json-rpc message.', { cause: { requestError, responseError } });
				}
			}
		})();
		await 'method' in parsed
			? this.server.accept(parsed)
			: this.client.accept(parsed);
	}

	toStream(): ReadableWritablePair<string, string> {
		let localTransport: typeof this.transport|undefined = undefined;
		return new TransformStream({
			start: controller => {
				localTransport = this.transport = messageStr => controller.enqueue(messageStr);
			},
			transform: message => this.accept(message),
			flush: () => {
				if (this.transport === localTransport) {
					this.transport = undefined;
				}
			},
		});
	}
}
