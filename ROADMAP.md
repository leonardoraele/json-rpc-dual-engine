- **Functional Enhancements:**
	- Implement feature that allows users to associate custom exceptions to jsonrpc error codes so that the jsonrpc
		response will have a custom error code
		(currently, error responses for user exceptions will always have the error code -32000)
	- Implement timeout for client call responses
	- Support middlewares
	
- **Performance Enhancements**
	- Improving the engine instantiation by moving method definitions to a shared prototype object so that each function
		wont be recreated for each engine
	- Consider alternatives to using proxies in the server context prototypes

- **Project Configuration**
	- Use either egoist/testen, vadimdemedes/trevor, or Travis CI to run tests simutaneously in all Node.js versions to
		ensure coverage
	- Use babel to support older Node.js versions

- **Documentation Enhancements:**
	- Create documentation for context-related features
	- Create ts type files

- **Other:**
	- Move the tasks in this file to an external tool (e.g. GitHub Projects)
