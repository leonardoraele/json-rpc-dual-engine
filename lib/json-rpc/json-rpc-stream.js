const stream = require('stream');

module.exports = (engine, streamOptions) =>
{
	const streamObj = new stream.Duplex(
	{
		...streamOptions,
		read()
		{},
		write(chunk, encoding, callback)
		{
			this.engine.accept(chunk.toString())
				.then(() => callback())
				.catch(callback);
		},
	});
	engine.onrequest = engine.onresponse = message => streamObj.push(message, 'utf8');
	streamObj.engine = engine;
	return streamObj;
};
