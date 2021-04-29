const { expect } = require('chai');
const Throw = require('../../lib/util/throw');

describe('throw', function()
{
	it('throws errors with message', function()
	{
		expect(() => Throw('error message')).to.throw();
	});
	it('throws user-created errors', function()
	{
		expect(() => Throw(new Error('some error'))).to.throw();
	});
});
