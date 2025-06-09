import { type Hfs } from '@humanfs/core'
import type { HfsWalkEntry } from '@humanfs/types'
import ignore from 'ignore'
import { dirname, parse } from 'pathe'
import { uint8ArrayToBase64 } from 'uint8array-extras'
import { assertFileNode } from './is.js'
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
} from './types.js'

const defaultIgnore = ['node_modules', '.git', '.DS_Store']

export abstract class Base {
	protected hfs: Hfs

	constructor(hfs: Hfs) {
		this.hfs = hfs
	}

	abstract tree<Content = string>(
		dirPath: string,
		options?: Options<Content>,
	): Promise<DirectoryNode<Content>>

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

	list(dirPath: string) {
		return this.hfs.list(dirPath)
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

	async file<Content = string>(
		filePath: string,
		options?: Pick<Options<Content>, 'content'>,
	): Promise<FileNode<Content> | undefined> {
		for await (const entry of this.walk(dirname(filePath))) {
			if (entry.isFile && filePath === entry.path) {
				const file = await this.createNode(entry.path, entry, options?.content)
				assertFileNode<Content>(file)
				return file
			}
		}
	}

	async *files<Content = string>(
		dirPath: string,
		options?: Options<Content>,
	): AsyncIterable<FileNode<Content>> {
		const filter = options?.filter ?? defaultIgnore
		for await (const entry of this.walk(dirPath, filter)) {
			if (entry.isDirectory) {
				continue
			}

			const file = await this.createNode(entry.path, entry, options?.content)
			assertFileNode<Content>(file)
			yield file
		}
	}

	protected async createNode<TContent = string>(
		path: string,
		entry: HfsWalkEntry,
		contentTransformer?: ContentTransformer<TContent>,
	): Promise<TreeNode<TContent>> {
		const modified = await this.hfs.lastModified(path)
		const parsed = parse(path)
		const base: BaseNode = {
			name: parsed.name,
			depth: entry.depth,
			path: entry.path,
			modified,
		}

		if (entry.isFile) {
			const size = await this.hfs.size(path)
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
}
