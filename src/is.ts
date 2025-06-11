import { DirectoryNode, FileNode, TreeNode } from './types.js'

export function isTreeNode<T = string>(value: unknown): value is TreeNode<T> {
	return (
		typeof value === 'object' &&
		!!value &&
		'type' in value &&
		typeof value.type === 'string' &&
		(value.type === 'file' || value.type === 'directory')
	)
}

export function isFileNode<T = string>(node: unknown): node is FileNode<T> {
	return isTreeNode(node) && node.type === 'file'
}

export function isDirectoryNode<T = string>(
	node: unknown,
): node is DirectoryNode<T> {
	return isTreeNode(node) && node.type === 'directory'
}

export function assertFileNode<T = string>(
	value: unknown,
	msg = 'value is not a file',
): asserts value is FileNode<T> {
	if (!isFileNode(value)) {
		throw new Error(msg)
	}
}

export function assertDirectoryNode<T = string>(
	value: unknown,
	msg = 'value is not a directory',
): asserts value is DirectoryNode<T> {
	if (!isDirectoryNode(value)) {
		throw new Error(msg)
	}
}
