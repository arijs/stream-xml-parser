
var _skip = 1;
var _abort = 2;
var _remove = 4;
export var treeWalkIsSkip = ret => ret & _skip;
export var treeWalkIsAbort = ret => ret & _abort;
export var treeWalkIsRemove = ret => ret & _remove;

export function getNodeCtx(index, count) {
	return {index, count};
}

export function buildNodeEntry(node, parentNode, ctxItem) {
	var childIndex = ctxItem ? ctxItem.index : null;
	var childCount = ctxItem ? ctxItem.count : null;
	return {
		node,
		parentNode,
		childIndex,
		childCount,
	};
}

export function buildNodeEntryFromPath(path, pathCtx, i) {
	var pathNode = path[i];
	var parentNode = i > 0 ? path[i - 1] : null;
	var ctxItem = pathCtx[i];
	return buildNodeEntry(pathNode, parentNode, ctxItem);
}

function treeWalk(nodeElement, elAdapter, walkFns, path = [], pathCtx = [], nodeCtx = null) {
	var ret = 0;
	var ctx = {
		nodeCtx,
		pathCtx,
		skip() { ret |= _skip; },
		abort() { ret |= _abort; },
		remove() { ret |= _remove; },
	};
	var pathLast = path[path.length - 1];
	var node = buildNodeEntry(nodeElement, pathLast && pathLast.node, nodeCtx);
	var {onNode, onText, onComment, onDeclaration, onInstruction} = walkFns;
	if (elAdapter.isText(nodeElement)) {
		if (onText) onText.call(ctx, {node, path, elAdapter});
		return ret;
	} else if (elAdapter.isComment(nodeElement)) {
		if (onComment) onComment.call(ctx, {node, path, elAdapter});
		return ret;
	} else if (elAdapter.isDeclaration(nodeElement)) {
		if (onDeclaration) onDeclaration.call(ctx, {node, path, elAdapter});
		return ret;
	} else if (elAdapter.isInstruction(nodeElement)) {
		if (onInstruction) onInstruction.call(ctx, {node, path, elAdapter});
		return ret;
	}
	if (!(path instanceof Array)) path = [];
	if (onNode) onNode.call(ctx, {node, path, elAdapter});
	if (
		treeWalkIsSkip(ret) ||
		treeWalkIsAbort(ret) ||
		treeWalkIsRemove(ret)
	) return ret;
	path = [...path, node];
	pathCtx = [...pathCtx, nodeCtx];
	var rc = elAdapter.childCount(nodeElement);
	for (var i = 0; i < rc; i++) {
		ret = treeWalk(
			elAdapter.childIndexGet(nodeElement, i),
			elAdapter,
			walkFns,
			path,
			pathCtx,
			getNodeCtx(i, rc),
		);
		if (treeWalkIsRemove(ret)) {
			elAdapter.childSplice(nodeElement, i, 1)
			i--, rc--
		}
		if (treeWalkIsAbort(ret)) return ret;
		ret = 0;
	}
	return ret;
}

export default treeWalk;

export function getFullTreePath(root, testTarget, elAdapter) {
	let targetEntry = null;
	treeWalk(root, elAdapter, {
		onNode: function(entry) {
			if (testTarget(entry)) {
				targetEntry = entry;

				return this.abort();
			}
		},
	}, []);
	return targetEntry;
}
