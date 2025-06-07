import { MemoryHfs } from '@humanfs/memory'
import { Canopy as BaseCanopy, type CanopyOptions } from './canopy.js'

export class Canopy extends BaseCanopy {
	constructor(opts?: CanopyOptions) {
		super(new MemoryHfs(), opts)
	}
}

export function createCanopy(opts?: CanopyOptions): Canopy {
	return new Canopy(opts)
}

export const canopy = createCanopy()
