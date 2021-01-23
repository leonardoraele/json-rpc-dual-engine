const COUNTER = Symbol('#counter');

export default () => (
{
	[COUNTER]: 1,
	next()
	{
		return `${this[COUNTER]++}`;
	},
});
