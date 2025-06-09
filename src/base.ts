import { type Hfs } from '@humanfs/core'
import type { HfsWalkEntry } from '@humanfs/types'
import ignore from 'ignore'
import { dirname, join, parse } from 'pathe'
import { uint8ArrayToBase64 } from 'uint8array-extras'
import type {
	ContentTransformer,
	ContentType,
	DirectoryNode,
	FileContent,
	FileNode,
	Filter,
	LogEntries,
	Options,
	TreeNode,
} from './types.js'

export class Base {
	protected hfs: Hfs

	constructor(hfs: Hfs) {
		this.hfs = hfs
	}

	async read<T extends ContentType = 'text'>(
		filePath: string,
		options?: { type?: T },
	): Promise<FileContent<T>> {
		const { type = 'text' } = options ?? {}
		if (type === 'bytes') {
			return (await this.hfs.bytes(filePath)) as FileContent<T>
		}
		if (type === 'json') {
			return (await this.hfs.json(filePath)) as FileContent<T>
		}
		if (type === 'base64') {
			const bytes = await this.hfs.bytes(filePath)
			return (bytes ? uint8ArrayToBase64(bytes) : bytes) as FileContent<T>
		}

		return (await this.hfs.text(filePath)) as FileContent<T>
	}

	async write(
		filePath: string,
		contents: string | ArrayBuffer | ArrayBufferView,
	): Promise<void> {
		await this.hfs.write(filePath, contents)
	}

	async copy(source: string, destination: string): Promise<void> {
		const isFile = await this.hfs.isFile(source)

		if (isFile) {
			await this.hfs.copy(source, destination)
		} else {
			await this.hfs.copyAll(source, destination)
		}
	}

	async move(source: string, destination: string): Promise<void> {
		const isFile = await this.hfs.isFile(source)

		if (isFile) {
			await this.hfs.move(source, destination)
		} else {
			await this.hfs.moveAll(source, destination)
		}
	}

	async delete(path: string): Promise<boolean> {
		const isDirectory = await this.hfs.isDirectory(path)
		if (isDirectory) {
			return await this.hfs.deleteAll(path)
		}
		return await this.hfs.delete(path)
	}

	walk(dirPath: string, filter?: Filter): AsyncIterable<HfsWalkEntry> {
		const filterFn = this.#createFilter(filter)

		return this.hfs.walk(dirPath, {
			directoryFilter: filterFn,
			entryFilter: filterFn,
		})
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

	logStart(name: string) {
		this.hfs.logStart(name)
	}

	logEnd(name: string): LogEntries {
		return this.hfs.logEnd(name)
	}

	async directory<Content = string>(
		dirPath: string,
		options?: Options<Content>,
	): Promise<TreeNode<Content>[]> {
		const entries = this.walk(dirPath, options?.filter)
		const nodes = new Map<string, TreeNode<Content>>()
		const rootNodes: TreeNode<Content>[] = []

		for await (const entry of entries) {
			const path = join(dirPath, entry.path)
			const node = await this.createNode(path, entry, options?.content)

			nodes.set(path, node)

			if (node.depth === 1) {
				rootNodes.push(node)
			}

			const parentNode = nodes.get(dirname(path))
			if (parentNode?.type === 'directory') {
				parentNode.children.push(node)
			}
		}

		return rootNodes
	}

	protected async createNode<TContent = string>(
		dirPath: string,
		entry: HfsWalkEntry,
		contentTransformer?: ContentTransformer<TContent>,
	): Promise<TreeNode<TContent>> {
		if (entry.isFile) {
			return await this.createFileNode(dirPath, entry, contentTransformer)
		}

		return this.createDirectoryNode(entry)
	}

	protected createDirectoryNode<TContent = string>(
		entry: HfsWalkEntry,
	): DirectoryNode<TContent> {
		return {
			name: entry.name,
			depth: entry.depth,
			path: entry.path,
			type: 'directory',
			children: [],
		}
	}

	protected async createFileNode<TContent = string>(
		path: string,
		entry: HfsWalkEntry,
		contentTransformer?: ContentTransformer<TContent>,
	): Promise<FileNode<TContent>> {
		const parsed = parse(path)
		const size = await this.hfs.size(path)
		const rawContent = await this.read(path)
		if (typeof rawContent === 'undefined') {
			throw Error(`Error reading ${path}`)
		}

		const node: FileNode<TContent> = {
			content: rawContent as TContent,
			isSymlink: entry.isSymlink,
			type: 'file',
			ext: parsed.ext,
			size,
			base: parsed.base,
			name: parsed.name,
			depth: entry.depth,
			path: entry.path,
		}

		node.content = contentTransformer
			? await contentTransformer({ ...node })
			: (rawContent as TContent)

		return node
	}
}
