import { MemoryHfs } from '@humanfs/memory'
import { Canopy } from './canopy.js'

export function createCanopy(): Canopy {
	return new Canopy(new MemoryHfs())
}

export const canopy = createCanopy()
