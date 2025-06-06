import { HfsWalkEntry } from '@humanfs/types'

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
	root: string
	path: string
	modified: Date | undefined
	depth: number
}

export interface FileNode extends BaseNode {
	isSymlink: boolean
	base: string
	content: string
	ext: string
	size: number
	type: 'file'
}

export interface DirectoryNode extends BaseNode {
	type: 'directory'
	children: TreeNode[]
}

// Represents a symlink pointing to another location
export interface SymlinkNode {
	file: string
}

export type TreeNode = FileNode | DirectoryNode

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
 * Represents a file system tree structure
 */
export type TreeEntry =
	| string // File content
	| { directory: TreeStructure } // Directory with contents
	| {} // Empty directory

export type TreeStructure = Record<string, TreeEntry>
