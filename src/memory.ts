import { MemoryHfs } from '@humanfs/memory'
import { join } from 'pathe'
import { Base } from './base.js'
import { TreeNode, TreeStructure } from './types.js'

export class Canopy extends Base {
	constructor() {
		super(new MemoryHfs())
	}

	async mount<Content = string>(
		input: TreeStructure | TreeNode<Content>[],
	): Promise<void> {
		if (Array.isArray(input)) {
			await this.#mountNodes(input)
		} else {
			await this.#writeTree(input, '.')
		}
	}

	async #mountNodes<Content = string>(nodes: TreeNode<Content>[]) {
		for (const node of nodes) {
			if (node.type === 'file') {
				await this.hfs.write(node.path, node.content as string)
			}
			if (node.type === 'directory') {
				await this.#mountNodes(node.children)
			}
		}
	}

	async #writeTree(tree: TreeStructure, basePath: string) {
		for (const [name, node] of Object.entries(tree)) {
			const fullPath = join(basePath, name)

			if (typeof node === 'string') {
				await this.hfs.write(fullPath, node)
			}

			if (typeof node === 'object') {
				await this.hfs.createDirectory(fullPath)
				await this.#writeTree(node, fullPath)
			}
		}
	}
}
