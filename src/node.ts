import { NodeHfs } from '@humanfs/node'
import { Base } from './base.js'

export class Canopy extends Base {
	constructor() {
		super(new NodeHfs())
	}
}
