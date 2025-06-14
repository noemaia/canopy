import { NodeHfs } from '@humanfs/node'
import { walk } from '../playground/lib/dev-path.js'
import { Base } from './base.js'

export class Canopy extends Base {
	constructor() {
		super(new NodeHfs())
	}
}

walk('./utils', import.meta.dirname)
