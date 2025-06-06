import { DirectoryNode, FileNode, TreeNode } from './types.js'

export function isTreeNode(value: unknown): value is TreeNode {
	return (
		typeof value === 'object' &&
		!!value &&
		'type' in value &&
		typeof value.type === 'string' &&
		(value.type === 'file' || value.type === 'directory')
	)
}

export function isFileNode(node: unknown): node is FileNode {
	return isTreeNode(node) && node.type === 'file'
}

export function isDirectoryNode(node: unknown): node is DirectoryNode {
	return isTreeNode(node) && node.type === 'directory'
}

export function assertFileNode(
	value: unknown,
	msg = 'value is not a file',
): asserts value is FileNode {
	if (!isFileNode(value)) {
		throw new Error(msg)
	}
}

export function assertDirectoryNode(
	value: unknown,
	msg = 'value is not a directory',
): asserts value is DirectoryNode {
	if (!isDirectoryNode(value)) {
		throw new Error(msg)
	}
}
