import { Hfs } from '@humanfs/core'
import { HfsWalkEntry } from '@humanfs/types'

export type LogEntries = ReturnType<Hfs['logEnd']>

export type ContentType = 'text' | 'json' | 'bytes' | 'base64'

export type FileContent<T extends ContentType> = T extends 'text'
	? string | undefined
	: T extends 'json'
		? JsonValue | undefined
		: T extends 'bytes'
			? Uint8Array | undefined
			: never

export interface BaseNode {
	name: string
	path: string
	depth: number
}

export interface FileNode<TContent = string> extends BaseNode {
	isSymlink: boolean
	base: string
	content: TContent
	ext: string
	size: number
	type: 'file'
}

export interface DirectoryNode<TContent = string> extends BaseNode {
	type: 'directory'
	children: TreeNode<TContent>[]
}

// Represents a symlink pointing to another location
export interface SymlinkNode {
	file: string
}

export type TreeNode<TContent = string> =
	| FileNode<TContent>
	| DirectoryNode<TContent>

export type JsonObject = { [Key in string]: JsonValue } & {
	[Key in string]?: JsonValue | undefined
}

export type JsonArray = JsonValue[] | readonly JsonValue[]

export type JsonPrimitive = string | number | boolean | null

export type JsonValue = JsonPrimitive | JsonObject | JsonArray

/**
 * Filter type - can be either an array of ignore patterns or a filter function
 */
export type Filter =
	| string[]
	| ((entry: HfsWalkEntry) => Promise<boolean> | boolean)

/**
 * Content transformer function type
 */
export type ContentTransformer<Content = string> = (
	node: FileNode<Content>,
) => Content | Promise<Content>

/**
 * Options for file operations
 */
export interface Options<Content = string> {
	content?: ContentTransformer<Content>
	filter?: Filter
}

/**
 * Represents a file system tree structure
 * - string values represent file contents
 * - object values represent directories (including empty directories as {})
 */
export interface TreeStructure {
	[key: string]: string | TreeStructure
}
