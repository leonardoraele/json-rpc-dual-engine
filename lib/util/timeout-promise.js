module.exports = function TimeoutPromise(timeout, message, callback, onreject)
{
	return new Promise((resolve, reject) =>
	{
		setTimeout(
			() =>
			{
				reject(new Error(message));
				onreject?.();
			},
			timeout,
		);
		callback(resolve, reject);
	});
};
