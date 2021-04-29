module.exports = function Throw(error)
{
	if (typeof error === 'string')
	{
		throw new Error(error);
	}
	else
	{
		throw error;
	}
};
