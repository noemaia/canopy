import { MemoryHfs } from '@humanfs/memory'
import { basename, dirname, join } from 'pathe'
import { Base } from './base.js'
import { isDirectoryNode, isFileNode } from './is.js'
import { DirectoryNode, Options, TreeNode, TreeStructure } from './types.js'

export class Canopy extends Base {
	constructor() {
		super(new MemoryHfs())
	}

	async mount(input: TreeStructure | DirectoryNode, basePath?: string) {
		if (isDirectoryNode(input)) {
			await this.#writeDirectoryNode(input, input.path)
		} else {
			await this.#writeTree(input, basePath ?? '.')
		}
	}

	async #writeDirectoryNode(node: DirectoryNode, basePath: string) {
		for (const child of node.children) {
			const path = join(basePath, child.path)
			if (isFileNode(child)) {
				await this.hfs.write(path, child.content)
			} else if (isDirectoryNode(child)) {
				await this.hfs.createDirectory(node.name)
				await this.#writeDirectoryNode(child, basePath)
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

	async tree<Content = string>(
		dirPath: string,
		options?: Options<Content>,
	): Promise<DirectoryNode<Content>> {
		const entries = this.walk(dirPath, options?.filter)
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
		const nodes = new Map<string, TreeNode<Content>>([
			[rootNode.path, rootNode],
		])

		for await (const entry of entries) {
			const fullPath = join(dirPath, entry.path)
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
