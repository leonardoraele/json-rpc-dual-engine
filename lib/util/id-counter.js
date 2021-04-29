const COUNTER = Symbol('#counter');

module.exports = () => (
{
	[COUNTER]: 1,
	next()
	{
		return `${this[COUNTER]++}`;
	},
});
