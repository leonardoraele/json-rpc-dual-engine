import { Writable, Readable } from 'node:stream';
import { JsonRpcClient } from './json-rpc-client.js';

export async function toNodeStreamPair(client: JsonRpcClient): Promise<{ input: Writable, output: Readable }> {
	const { input: webInput, output: webOutput } = client.toStreamPair();
	const input = Writable.fromWeb(webInput);
	const output = Readable.fromWeb(webOutput);
	return { input, output };
}
