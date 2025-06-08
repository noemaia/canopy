import { type Hfs } from '@humanfs/core'
import type { HfsWalkEntry } from '@humanfs/types'
import ignore from 'ignore'
import { dirname, isAbsolute, join, parse, resolve } from 'pathe'
import { uint8ArrayToBase64 } from 'uint8array-extras'
import { assertFileNode, isDirectoryNode, isFileNode } from './is.js'
import type {
	BaseNode,
	ContentTransformer,
	ContentType,
	DirectoryNode,
	FileContent,
	FileNode,
	Filter,
	LogEntries,
	Options,
	TreeNode,
	TreeStructure,
} from './types.js'

const defaultIgnore = ['node_modules', '.git', '.DS_Store']

export interface CanopyOptions {
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
			await this.#writeDirectoryNode(input, this.#root)
		} else {
			await this.#writeTree(input, this.#root)
		}
	}

	async #writeDirectoryNode(node: DirectoryNode, basePath: string) {
		for (const child of node.children) {
			const childPath = join(basePath, child.path)

			if (isFileNode(child)) {
				await this.#hfs.write(childPath, child.content)
			} else if (isDirectoryNode(child)) {
				await this.#hfs.createDirectory(childPath)
				await this.#writeDirectoryNode(child, childPath)
			}
		}
	}

	async #writeTree(tree: TreeStructure, basePath: string) {
		for (const [name, node] of Object.entries(tree)) {
			const fullPath = join(basePath, name)

			if (typeof node === 'string') {
				await this.#hfs.write(fullPath, node)
				continue
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
		const path = this.resolvePath(filePath)

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
		const path = this.resolvePath(filePath)
		await this.#hfs.write(path, contents)
	}

	async copy(source: string, destination: string): Promise<void> {
		const sourcePath = this.resolvePath(source)
		const destinationPath = this.resolvePath(destination)
		const isFile = await this.#hfs.isFile(sourcePath)

		if (isFile) {
			await this.#hfs.copy(sourcePath, destinationPath)
		} else {
			await this.#hfs.copyAll(sourcePath, destinationPath)
		}
	}

	async move(source: string, destination: string): Promise<void> {
		const sourcePath = this.resolvePath(source)
		const destinationPath = this.resolvePath(destination)
		const isFile = await this.#hfs.isFile(source)

		if (isFile) {
			await this.#hfs.move(sourcePath, destinationPath)
		} else {
			await this.#hfs.moveAll(sourcePath, destinationPath)
		}
	}

	async delete(path: string): Promise<boolean> {
		const resolvedPath = this.resolvePath(path)
		const isDirectory = await this.#hfs.isDirectory(resolvedPath)
		if (isDirectory) {
			return await this.#hfs.deleteAll(resolvedPath)
		}
		return await this.#hfs.delete(resolvedPath)
	}

	async file<Content = string>(
		filePath: string,
		options?: Pick<Options<Content>, 'content'>,
	): Promise<FileNode<Content> | undefined> {
		const resolved = this.resolvePath(filePath)

		for await (const { entry, path } of this.walk(dirname(resolved))) {
			if (entry.isFile && resolved === path) {
				const file = await this.createNode(path, entry, options?.content)
				assertFileNode<Content>(file)
				return file
			}
		}
	}

	async *files<Content = string>(
		dirPath?: string,
		options?: Options<Content>,
	): AsyncIterable<FileNode<Content>> {
		const filter = options?.filter ?? defaultIgnore
		for await (const { entry, path } of this.walk(dirPath, filter)) {
			if (entry.isDirectory) {
				continue
			}

			const file = await this.createNode(path, entry, options?.content)
			assertFileNode<Content>(file)
			yield file
		}
	}

	async tree<Content = string>(
		dirPath?: string,
		options?: Options<Content>,
	): Promise<DirectoryNode<Content>> {
		const entries = this.walk(dirPath, options?.filter)
		const nodes = new Map<string, TreeNode<Content>>()
		const resolvedPath = this.resolvePath(dirPath)
		const parsed = parse(resolvedPath)
		const modified = await this.#hfs.lastModified(resolvedPath)

		const rootNode: DirectoryNode<Content> = {
			depth: 0,
			children: [],
			modified,
			root: parsed.root,
			path: parsed.base,
			type: 'directory',
			name: parsed.name,
		}

		nodes.set(resolvedPath, rootNode)

		for await (const { path, entry } of entries) {
			const node = await this.createNode(path, entry, options?.content)

			nodes.set(path, node)

			const parentNode = nodes.get(dirname(path))
			if (parentNode?.type === 'directory') {
				parentNode.children.push(node)
			}
		}

		return rootNode
	}

	protected async createNode<TContent = string>(
		path: string,
		entry: HfsWalkEntry,
		contentTransformer?: ContentTransformer<TContent>,
	): Promise<TreeNode<TContent>> {
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
			const rawContent = await this.read(path)
			if (typeof rawContent === 'undefined') {
				throw Error(`Error reading ${path}`)
			}

			const content = contentTransformer
				? await contentTransformer(rawContent)
				: (rawContent as TContent)

			return {
				isSymlink: entry.isSymlink,
				type: 'file',
				ext: parsed.ext,
				size,
				base: parsed.base,
				content,
				...base,
			} satisfies FileNode<TContent>
		}

		return {
			type: 'directory',
			children: [],
			...base,
		} satisfies DirectoryNode<TContent>
	}

	list(dirPath: string = this.#root) {
		const resolvedPath = this.resolvePath(dirPath)
		return this.#hfs.list(resolvedPath)
	}

	async *walk(
		dirPath?: string,
		filter?: Filter,
	): AsyncIterable<{ path: string; entry: HfsWalkEntry }> {
		const resolvedPath = this.resolvePath(dirPath)
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

	protected resolvePath(relativePath?: string): string {
		if (relativePath && isAbsolute(relativePath)) {
			return relativePath
		}
		return resolve(this.#root, relativePath ?? '')
	}

	logStart(name: string) {
		this.#hfs.logStart(name)
	}

	logEnd(name: string): LogEntries {
		return this.#hfs.logEnd(name)
	}
}
