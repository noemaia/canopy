import { MemoryHfs } from '@humanfs/memory'
import { Canopy, type CanopyOptions } from './canopy.js'

export function createCanopy(opts?: CanopyOptions): Canopy {
	return new Canopy(new MemoryHfs(), opts)
}

export const canopy = createCanopy()
