import { HfsWalkEntry } from '@humanfs/types'
import ignore from 'ignore'
import { Filter } from '../types.js'

export function createFilter({
	ignore,
	include,
}: {
	include?: Filter
	ignore?: Filter
} = {}): ((entry: HfsWalkEntry) => Promise<boolean> | boolean) | undefined {
	if (!include && !ignore) {
		return
	}

	return async (entry: HfsWalkEntry) => {
		if (include) {
			const shouldInclude = await evaluateFilter(include, entry)
			if (!shouldInclude) {
				return false
			}
		}

		if (ignore) {
			const shouldIgnore = await evaluateFilter(ignore, entry)
			if (shouldIgnore) {
				return false
			}
		}

		return true
	}
}

export function evaluateFilter(
	filter: Filter,
	entry: HfsWalkEntry,
): Promise<boolean> | boolean {
	if (Array.isArray(filter)) {
		const ig = ignore().add(filter)
		return ig.ignores(entry.path)
	}

	return filter(entry)
}
