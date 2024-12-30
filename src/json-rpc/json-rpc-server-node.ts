import { Duplex } from 'node:stream';
import { JsonRpcServer } from './json-rpc-server.js';

export async function toNodeStream(server: JsonRpcServer): Promise<Duplex> {
	return Duplex.fromWeb(server.toStream());
}
