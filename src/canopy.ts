import { type Hfs } from '@humanfs/core'
import type { HfsWalkEntry } from '@humanfs/types'
import ignore from 'ignore'
import { dirname, isAbsolute, join, parse, resolve } from 'pathe'
import { uint8ArrayToBase64 } from 'uint8array-extras'
import { assertFileNode, isDirectoryNode, isFileNode } from './is.js'
import type {
	BaseNode,
	ContentType,
	DirectoryNode,
	FileContent,
	FileNode,
	Filter,
	LogEntries,
	TreeNode,
	TreeStructure,
} from './types.js'

const defaultIgnore = ['node_modules', '.git', '.DS_Store']

export interface CanopyOptions {
	/**
	 * The base directory for resolving relative paths.
	 * @example { dir: import.meta.dirname } // Resolves relative paths from the executing file
	 */
	dir?: string
}

export class Canopy {
	#hfs: Hfs
	#root = '.' // MemoryHfs treats `.` as the root

	constructor(hfs: Hfs, opts?: CanopyOptions) {
		this.#hfs = hfs
		if (opts?.dir) {
			this.#root = opts.dir
		}
	}

	async hydrate(input: TreeStructure | DirectoryNode) {
		if (isDirectoryNode(input)) {
			await this.#writeDirectoryNode(input)
		} else {
			await this.#writeTree(input)
		}
	}

	async #writeDirectoryNode(node: DirectoryNode, basePath?: string) {
		for (const child of node.children) {
			const childPath = basePath ? `${basePath}/${child.name}` : child.name

			if (isFileNode(child)) {
				await this.#hfs.write(childPath, child.content)
			} else if (isDirectoryNode(child)) {
				await this.#hfs.createDirectory(childPath)
				await this.#writeDirectoryNode(child, childPath)
			}
		}
	}

	async #writeTree(tree: TreeStructure, basePath?: string) {
		for (const [name, node] of Object.entries(tree)) {
			const fullPath = basePath ? `${basePath}/${name}` : name

			if (typeof node === 'string') {
				await this.#hfs.write(fullPath, node)
				return
			}

			if (typeof node === 'object') {
				if ('directory' in node) {
					const hasFiles = Object.values(tree).some(
						(node) => typeof node === 'string',
					)
					if (!hasFiles) {
						await this.#hfs.createDirectory(fullPath)
					}
					await this.#writeTree(node.directory, fullPath)
				} else {
					// It's an empty directory (empty object)
					await this.#hfs.createDirectory(fullPath)
				}
			}
		}
	}

	async read<T extends ContentType = 'text'>(
		filePath: string,
		options?: { type?: T },
	): Promise<FileContent<T>> {
		const path = this.#resolvePath(filePath)

		const { type = 'text' } = options ?? {}
		if (type === 'bytes') {
			return (await this.#hfs.bytes(path)) as FileContent<T>
		}
		if (type === 'json') {
			return (await this.#hfs.json(path)) as FileContent<T>
		}
		if (type === 'base64') {
			const bytes = await this.#hfs.bytes(path)
			return (bytes ? uint8ArrayToBase64(bytes) : bytes) as FileContent<T>
		}

		return (await this.#hfs.text(path)) as FileContent<T>
	}

	async write(
		filePath: string,
		contents: string | ArrayBuffer | ArrayBufferView,
	): Promise<void> {
		const path = this.#resolvePath(filePath)
		await this.#hfs.write(path, contents)
	}

	async copy(source: string, destination: string): Promise<void> {
		const sourcePath = this.#resolvePath(source)
		const destinationPath = this.#resolvePath(destination)
		const isFile = await this.#hfs.isFile(sourcePath)

		if (isFile) {
			await this.#hfs.copy(sourcePath, destinationPath)
		} else {
			await this.#hfs.copyAll(sourcePath, destinationPath)
		}
	}

	async move(source: string, destination: string): Promise<void> {
		const sourcePath = this.#resolvePath(source)
		const destinationPath = this.#resolvePath(destination)
		const isFile = await this.#hfs.isFile(source)

		if (isFile) {
			await this.#hfs.move(sourcePath, destinationPath)
		} else {
			await this.#hfs.moveAll(sourcePath, destinationPath)
		}
	}

	async delete(path: string): Promise<boolean> {
		const resolvedPath = this.#resolvePath(path)
		const isDirectory = await this.#hfs.isDirectory(resolvedPath)
		if (isDirectory) {
			return await this.#hfs.deleteAll(resolvedPath)
		}
		return await this.#hfs.delete(resolvedPath)
	}

	async *files(
		dirPath?: string,
		filter: Filter = defaultIgnore,
	): AsyncIterable<FileNode> {
		for await (const { entry, path } of this.walk(dirPath, filter)) {
			if (entry.isDirectory) {
				continue
			}

			const file = await this.createNode(path, entry)
			assertFileNode(file)
			yield file
		}
	}

	async tree(dirPath?: string, filter?: Filter): Promise<DirectoryNode> {
		const entries = this.walk(dirPath, filter)
		const nodeMap = new Map<string, TreeNode>()
		const resolvedPath = this.#resolvePath(dirPath)
		const parsed = parse(resolvedPath)
		const modified = await this.#hfs.lastModified(resolvedPath)

		const rootNode: DirectoryNode = {
			depth: 0,
			children: [],
			modified,
			root: parsed.root,
			path: parsed.base,
			type: 'directory',
			name: parsed.name,
		}

		nodeMap.set(resolvedPath, rootNode)

		for await (const { path, entry } of entries) {
			const node = await this.createNode(path, entry)

			nodeMap.set(path, node)

			const parentNode = nodeMap.get(dirname(path))
			if (parentNode?.type === 'directory') {
				parentNode.children.push(node)
			}
		}

		return rootNode
	}

	private async createNode(
		path: string,
		entry: HfsWalkEntry,
	): Promise<TreeNode> {
		const modified = await this.#hfs.lastModified(path)
		const parsed = parse(path)
		const base: BaseNode = {
			name: parsed.name,
			root: parsed.root,
			depth: entry.depth,
			path: entry.path,
			modified,
		}

		if (entry.isFile) {
			const size = await this.#hfs.size(path)
			const content = await this.read(path)
			if (!content) {
				throw Error(`Error reading ${path}`)
			}
			return {
				isSymlink: entry.isSymlink,
				type: 'file',
				ext: parsed.ext,
				size,
				base: parsed.base,
				content,
				...base,
			} satisfies FileNode
		}

		return {
			type: 'directory',
			children: [],
			...base,
		} satisfies DirectoryNode
	}

	list(dirPath: string = this.#root) {
		const resolvedPath = this.#resolvePath(dirPath)
		return this.#hfs.list(resolvedPath)
	}

	async *walk(
		dirPath?: string,
		filter?: Filter,
	): AsyncIterable<{ path: string; entry: HfsWalkEntry }> {
		const resolvedPath = this.#resolvePath(dirPath)
		const filterFn = this.#createFilter(filter)
		for await (const entry of this.#hfs.walk(resolvedPath, {
			directoryFilter: filterFn,
			entryFilter: filterFn,
		})) {
			const path = resolve(resolvedPath, entry.path)
			yield { path, entry }
		}
	}

	#createFilter(
		patternsOrFilter?: Filter,
	): ((entry: HfsWalkEntry) => Promise<boolean> | boolean) | undefined {
		if (!patternsOrFilter) {
			return
		}

		if (Array.isArray(patternsOrFilter)) {
			const ig = ignore().add(patternsOrFilter)

			return (entry: HfsWalkEntry) => {
				// Return true to include (not ignored), false to exclude (ignored)
				return !ig.ignores(entry.path)
			}
		}

		return patternsOrFilter
	}

	#resolvePath(relativePath?: string): string {
		if (!relativePath) {
			return this.#root
		}
		if (isAbsolute(relativePath)) {
			return relativePath
		}
		return resolve(this.#root, relativePath)
	}

	logStart(name: string) {
		this.#hfs.logStart(name)
	}

	logEnd(name: string): LogEntries {
		return this.#hfs.logEnd(name)
	}
}
