import { NodeHfs } from '@humanfs/node'
import { Canopy, type CanopyOptions } from './canopy.js'

export function createCanopy(opts?: CanopyOptions): Canopy {
	return new Canopy(new NodeHfs(), opts)
}

export const canopy = createCanopy()
