import { NodeHfs } from '@humanfs/node'
import { Canopy } from './canopy.js'

export function createCanopy(): Canopy {
	return new Canopy(new NodeHfs())
}

export const canopy = createCanopy()
