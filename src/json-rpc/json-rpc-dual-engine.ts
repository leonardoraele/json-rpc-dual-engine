import { JsonRpcClient, MethodInterface } from './json-rpc-client.js';
import { JsonRpcServer } from './json-rpc-server.js';
import type { Duplex } from 'node:stream';

type ConstructorOptions = ConstructorParameters<typeof JsonRpcClient>[0] & ConstructorParameters<typeof JsonRpcServer>[1];
type MessageHandler = (message: string) => unknown;

export class JsonRpcDualEngine<RemoteAPI extends MethodInterface = any> {
	constructor(options: ConstructorOptions);
	constructor(api: object, options: ConstructorOptions);
	constructor(...args: any[]) {
		const options = args[1] ?? args[0] ?? {};
		const api = options === args[1] ? args[0] : {};
		this.server = new JsonRpcServer(api, options);
		this.client = new JsonRpcClient<RemoteAPI>(options);
	}

	readonly server: JsonRpcServer;
	readonly client: JsonRpcClient<RemoteAPI>;

	set onmessage(value: MessageHandler|undefined) {
		this.server.onresponse = value;
		this.client.onrequest = value;
	}

	async accept(message: unknown): Promise<void> {
		const object = typeof message === 'string' ? JSON.parse(message) : message;
		if ('method' in object) {
			await this.server.accept(message);
		} else {
			this.client.accept(message);
		}
	}

	toStream(): TransformStream<string, string> {
		return new TransformStream({
			start: controller => this.onmessage = response => controller.enqueue(response),
			transform: message => this.accept(message),
		});
	}

	async toNodeStream(): Promise<Duplex> {
		const { Duplex } = await import('node:stream');
		return Duplex.fromWeb(this.toStream());
	}
}
