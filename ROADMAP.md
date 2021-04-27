- Implement feature that allows users to associate custom exceptions to jsonrpc error codes so that the jsonrpc response
	will have a custom error code
	(currently, error responses for user exceptions will always have the error code -32000)
- Implement timeout for client call responses
- Support middlewares
- Improving the engine instantiation by moving method definitions to a shared prototype object so that each function
	wont be recreated for each engine
- Configure the project for Travis CI
- Use either egoist/testen, vadimdemedes/trevor or Travis CI to run tests simutaneously in all Node.js versions to
	ensure coverage
- Use babel to support older Node.js versions
- Create documentation for context-related features
