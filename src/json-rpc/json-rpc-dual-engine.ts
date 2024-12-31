import { JsonRpcClient, MethodInterface } from './json-rpc-client.js';
import { JsonRpcRequest } from './json-rpc-request.js';
import { JsonRpcResponse } from './json-rpc-response.js';
import { JsonRpcServer } from './json-rpc-server.js';

type ConstructorOptions = ConstructorParameters<typeof JsonRpcClient>[0] & ConstructorParameters<typeof JsonRpcServer>[0];
type MessageHandler = (message: string) => unknown;

export class JsonRpcDualEngine<RemoteAPI extends MethodInterface = any> {
	constructor(options?: ConstructorOptions) {
		this.server = new JsonRpcServer(options);
		this.client = new JsonRpcClient<RemoteAPI>(options);
	}

	readonly server: JsonRpcServer;
	readonly client: JsonRpcClient<RemoteAPI>;

	set onmessage(value: MessageHandler|undefined) {
		this.server.onresponse = value;
		this.client.onrequest = value;
	}

	async accept(message: unknown): Promise<void> {
		try {
			await this.#accept(message);
		} catch (cause) {
			console.error(new Error('Failed to accept json-rpc message.', { cause }));
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
		return new TransformStream({
			start: controller => this.onmessage = response => controller.enqueue(response),
			transform: message => this.accept(message),
		});
	}
}
