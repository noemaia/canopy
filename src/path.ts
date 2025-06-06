import { Path } from '@humanfs/core'
import { parse } from 'pathe'

type ParsedPath = ReturnType<typeof parse>

export class CanopyPath extends Path {
	#parsed: ParsedPath

	constructor(steps?: Iterable<string>) {
		super(steps)

		this.#parsed = parse(this.toString())
	}

	get root() {
		return this.#parsed.root
	}

	get directory() {
		return this.#parsed.dir
	}

	get base() {
		return this.#parsed.base
	}

	get ext() {
		return this.#parsed.ext
	}

	get name() {
		return this.#parsed.name
	}
}
