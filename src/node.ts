import { NodeHfs } from '@humanfs/node'
import { basename, dirname, join, resolve } from 'pathe'
import { Base } from './base.js'
import { DirectoryNode, Options, TreeNode } from './types.js'

export class Canopy extends Base {
	constructor() {
		super(new NodeHfs())
	}

	async tree<Content = string>(
		dirPath: string,
		options?: Options<Content>,
	): Promise<DirectoryNode<Content>> {
		const entries = this.walk(dirPath, options?.filter)
		const nodes = new Map<string, TreeNode<Content>>()
		const modified = await this.hfs.lastModified(dirPath)

		const base = basename(dirPath)
		const rootNode: DirectoryNode<Content> = {
			depth: 0,
			children: [],
			modified,
			path: base,
			type: 'directory',
			name: base,
		}

		nodes.set(rootNode.path, rootNode)

		for await (const entry of entries) {
			const fullPath = resolve(dirPath, entry.path)
			const path = join(rootNode.path, entry.path)
			const node = await this.createNode(
				fullPath,
				{ ...entry, path },
				options?.content,
			)

			nodes.set(node.path, node)

			const parentNode = nodes.get(dirname(node.path))
			if (parentNode?.type === 'directory') {
				parentNode.children.push(node)
			}
		}

		return rootNode
	}
}
