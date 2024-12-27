export class IdCounter {
	#counter = 1;
	next() {
		return this.#counter++;
	}
}
