import { isDirectoryNode, isFileNode } from '../is.js'
import { DirectoryNode, FileNode, TreeNode } from '../types.js'

/**
 * Recursively searches through an array of TreeNodes to find a FileNode
 * that matches the given comparator function.
 */
export function findFileNode<TContent = string>(
	nodes: TreeNode<TContent>[],
	comparator: (node: FileNode<TContent>) => boolean,
): FileNode<TContent> | undefined {
	for (const node of traverse(nodes)) {
		if (isFileNode(node) && comparator(node)) {
			return node
		}
	}
}

export function findDirectoryNode<TContent = string>(
	nodes: TreeNode<TContent>[],
	comparator: (node: DirectoryNode<TContent>) => boolean,
): DirectoryNode<TContent> | undefined {
	for (const node of traverse(nodes)) {
		if (isDirectoryNode(node) && comparator(node)) {
			return node
		}
	}
}

export function findAllFileNodes<TContent = string>(
	nodes: TreeNode<TContent>[],
	comparator: (node: FileNode<TContent>) => boolean,
): FileNode<TContent>[] {
	const matches: FileNode<TContent>[] = []

	for (const node of traverse(nodes)) {
		if (isFileNode(node) && comparator(node)) {
			matches.push(node)
		}
	}

	return matches
}

export function directoryIncludes<TContent = string>(
	nodes: TreeNode<TContent>[],
	comparator: (node: TreeNode<TContent>) => boolean,
): boolean {
	for (const node of traverse(nodes)) {
		if (comparator(node)) {
			return true
		}
	}
	return false
}

/**
 * Traverses an array of TreeNode objects and yields each TreeNode in the tree structure
 */
export function* traverse<TContent = string>(
	nodes: TreeNode<TContent>[],
): Generator<TreeNode<TContent>> {
	for (const node of nodes) {
		yield node

		if (isDirectoryNode(node) && node.children.length > 0) {
			yield* traverse(node.children as TreeNode<TContent>[])
		}
	}
}
