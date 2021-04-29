const stream = require('stream');

module.exports = (engine, { context } = {}) =>
{
	const streamObj = new stream.Duplex(
	{
		read()
		{},
		write(chunk, encoding, callback)
		{
			this.engine.accept(chunk.toString(), context)
				.then(() => callback())
				.catch(callback);
		},
	});
	engine.onrequest = engine.onresponse = streamObj.push.bind(streamObj);
	streamObj.engine = engine;
	return streamObj;
};
