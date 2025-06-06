import type { TreeNode } from '../types.js'

/**
 * ASCII tree visualization characters
 */
const TREE_CHARS = {
	BRANCH: '├── ',
	LAST: '└── ',
	VERTICAL: '│   ',
	SPACE: '    ',
} as const

/**
 * Options for tree visualization
 */
export interface TreeVisualizationOptions {
	/** Show file extensions (default: true) */
	extensions?: boolean
	/** Show modification dates (default: false) */
	showDates?: boolean
	/** Custom prefix for each line (default: '') */
	prefix?: string
	/** Maximum depth to display (default: unlimited) */
	maxDepth?: number

	stats?: boolean
}

/**
 * Logs an ASCII tree visualization of the folder structure
 *
 * @param nodes - Array of TreeNode objects to visualize
 * @param options - Visualization options
 *
 * @example
 * ```typescript
 * const tree = await mfs.toTree('/project')
 * logTree(tree)
 * // Output:
 * // project/
 * // ├── src/
 * // │   ├── components/
 * // │   │   └── Button.tsx
 * // │   └── utils.ts
 * // ├── docs/
 * // │   └── README.md
 * // └── package.json
 * ```
 */
export function logTree(
	nodes: TreeNode[],
	options: TreeVisualizationOptions = {},
): void {
	const output = generateTreeString(nodes, options)

	console.log(output)

	if (options.stats) {
		logTreeStats(nodes)
	}
}

/**
 * Generates an ASCII tree string representation of the folder structure
 *
 * @param nodes - Array of TreeNode objects to visualize
 * @param options - Visualization options
 * @returns The tree representation as a string
 */
export function generateTreeString(
	nodes: TreeNode[],
	options: TreeVisualizationOptions = {},
): string {
	const {
		extensions = true,
		showDates = false,
		prefix = '',
		maxDepth = Infinity,
	} = options

	const lines: string[] = []

	function formatNodeName(node: TreeNode): string {
		let name = node.name

		if (node.type === 'directory') {
			name += '/'
		} else if (node.type === 'file' && extensions) {
			name = node.base
		}

		if (showDates && node.modified) {
			const date = node.modified.toLocaleDateString()
			name += ` (${date})`
		}

		return name
	}

	function traverse(
		currentNodes: TreeNode[],
		currentPrefix: string,
		depth: number = 0,
	): void {
		if (depth >= maxDepth) return

		currentNodes.forEach((node, index) => {
			const isLast = index === currentNodes.length - 1
			const nodePrefix = isLast ? TREE_CHARS.LAST : TREE_CHARS.BRANCH
			const line = prefix + currentPrefix + nodePrefix + formatNodeName(node)

			lines.push(line)

			if (node.type === 'directory' && node.children.length > 0) {
				const nextPrefix =
					currentPrefix + (isLast ? TREE_CHARS.SPACE : TREE_CHARS.VERTICAL)
				traverse(node.children, nextPrefix, depth + 1)
			}
		})
	}

	traverse(nodes, '', 0)
	return lines.join('\n')
}

/**
 * Logs tree statistics
 *
 * @param nodes - Array of TreeNode objects to analyze
 */
export function logTreeStats(nodes: TreeNode[]): void {
	const stats = getTreeStats(nodes)

	console.log('\nStats:')
	console.log(`├── Total directories: ${stats.directoryCount}`)
	console.log(`├── Total files: ${stats.fileCount}`)
	console.log(`├── Max depth: ${stats.maxDepth}`)
	console.log(
		`└── File extensions: ${Array.from(stats.extensions).join(', ') || 'none'}`,
	)
}

/**
 * Gets statistics about the tree structure
 *
 * @param nodes - Array of TreeNode objects to analyze
 * @returns Tree statistics
 */
export function getTreeStats(nodes: TreeNode[]): {
	directoryCount: number
	fileCount: number
	maxDepth: number
	extensions: Set<string>
} {
	let directoryCount = 0
	let fileCount = 0
	let maxDepth = 0
	const extensions = new Set<string>()

	function traverse(currentNodes: TreeNode[], depth: number = 0): void {
		maxDepth = Math.max(maxDepth, depth)

		currentNodes.forEach((node) => {
			if (node.type === 'directory') {
				directoryCount++
				if (node.children.length > 0) {
					traverse(node.children, depth + 1)
				}
			} else {
				fileCount++
				if (node.ext) {
					extensions.add(node.ext)
				}
			}
		})
	}

	traverse(nodes)

	return {
		directoryCount,
		fileCount,
		maxDepth,
		extensions,
	}
}
