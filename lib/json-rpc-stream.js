import stream from 'stream';
import JsonRpcDualEngine from './json-rpc-dual-engine.js';

export default (engine = JsonRpcDualEngine()) =>
{
	const streamObj = new stream.Duplex(
	{
		read()
		{},
		write(chunk, encoding, callback)
		{
			this.engine.accept(chunk.toString())
				.then(() => callback())
				.catch(callback);
		},
	});
	engine.onrequest = engine.onresponse = streamObj.push.bind(streamObj);
	streamObj.engine = engine;
	return streamObj;
};
