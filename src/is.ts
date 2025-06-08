import { DirectoryNode, FileNode, TreeNode } from './types.js'

export function isTreeNode<TContent = string>(
	value: unknown,
): value is TreeNode<TContent> {
	return (
		typeof value === 'object' &&
		!!value &&
		'type' in value &&
		typeof value.type === 'string' &&
		(value.type === 'file' || value.type === 'directory')
	)
}

export function isFileNode<TContent = string>(
	node: unknown,
): node is FileNode<TContent> {
	return isTreeNode(node) && node.type === 'file'
}

export function isDirectoryNode<TContent = string>(
	node: unknown,
): node is DirectoryNode<TContent> {
	return isTreeNode(node) && node.type === 'directory'
}

export function assertFileNode<TContent = string>(
	value: unknown,
	msg = 'value is not a file',
): asserts value is FileNode<TContent> {
	if (!isFileNode(value)) {
		throw new Error(msg)
	}
}

export function assertDirectoryNode<TContent = string>(
	value: unknown,
	msg = 'value is not a directory',
): asserts value is DirectoryNode<TContent> {
	if (!isDirectoryNode(value)) {
		throw new Error(msg)
	}
}
