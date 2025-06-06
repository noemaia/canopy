import { MemoryHfs } from '@humanfs/memory'
import { Canopy } from './canopy.js'

export { Canopy } from './canopy.js'

export type {
	BaseNode,
	ContentType,
	DirectoryNode,
	FileContent,
	FileNode,
	Filter,
	JsonValue,
	TreeEntry,
	TreeNode,
	TreeStructure,
} from './types.js'

export { CanopyPath } from './path.js'

export {
	assertDirectoryNode,
	assertFileNode,
	isDirectoryNode,
	isFileNode,
	isTreeNode,
} from './is.js'

export const canopy = new Canopy(new MemoryHfs())
