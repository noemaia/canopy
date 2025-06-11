import { isDirectoryNode, isFileNode } from '../is.js'
import { DirectoryNode, FileNode, TreeNode } from '../types.js'

/**
 * Recursively searches through an array of TreeNodes to find a FileNode
 * that matches the given comparator function.
 */
export function findFileNode<T = string>(
	nodes: TreeNode<T>[],
	comparator: (node: FileNode<T>) => boolean,
): FileNode<T> | undefined {
	for (const node of traverse(nodes)) {
		if (isFileNode(node) && comparator(node)) {
			return node
		}
	}
}

export function findDirectoryNode<T = string>(
	nodes: TreeNode<T>[],
	comparator: (node: DirectoryNode<T>) => boolean,
): DirectoryNode<T> | undefined {
	for (const node of traverse(nodes)) {
		if (isDirectoryNode(node) && comparator(node)) {
			return node
		}
	}
}

export function findAllFileNodes<T = string>(
	nodes: TreeNode<T>[],
	comparator: (node: FileNode<T>) => boolean,
): FileNode<T>[] {
	const matches: FileNode<T>[] = []

	for (const node of traverse(nodes)) {
		if (isFileNode(node) && comparator(node)) {
			matches.push(node)
		}
	}

	return matches
}

/**
 * Traverses a `DirectoryNode` and all of its sub directories, yields each TreeNode in the tree structure
 */
export function directoryIncludes<T = string>(
	directory: DirectoryNode<T>,
	comparator: (node: TreeNode<T>) => boolean,
): boolean {
	for (const node of traverse(directory.children)) {
		if (comparator(node)) {
			return true
		}
	}

	return false
}

/**
 * Traverses an array of TreeNode objects and yields each TreeNode in the tree structure
 */
export function* traverse<T = string>(
	nodes: TreeNode<T>[],
): Generator<TreeNode<T>> {
	for (const node of nodes) {
		yield node

		if (isDirectoryNode(node) && node.children.length > 0) {
			yield* traverse(node.children as TreeNode<T>[])
		}
	}
}
