
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

function treeWalk({node: nodeElement, elAdapter, walkFns, path = [], pathCtx = [], nodeCtx = null, walkCtx = {}}) {
	var ret = 0;
	var ctx = {
		nodeCtx,
		pathCtx,
		walkCtx,
		skip() { ret |= _skip; },
		abort() { ret |= _abort; },
		remove() { ret |= _remove; },
	};
	var pathLast = path[path.length - 1];
	var node = buildNodeEntry(nodeElement, pathLast && pathLast.node, nodeCtx);
	var {onNode, onNodeExit, onText, onComment, onDeclaration, onInstruction} = walkFns;
	if (elAdapter.isText(nodeElement)) {
		if (onText) onText.call(ctx, {...ctx, node, path, elAdapter});
		return ret;
	} else if (elAdapter.isComment(nodeElement)) {
		if (onComment) onComment.call(ctx, {...ctx, node, path, elAdapter});
		return ret;
	} else if (elAdapter.isDeclaration(nodeElement)) {
		if (onDeclaration) onDeclaration.call(ctx, {...ctx, node, path, elAdapter});
		return ret;
	} else if (elAdapter.isInstruction(nodeElement)) {
		if (onInstruction) onInstruction.call(ctx, {...ctx, node, path, elAdapter});
		return ret;
	}
	if (!(path instanceof Array)) path = [];
	if (onNode) onNode.call(ctx, {...ctx, node, path, elAdapter});
	if (treeWalkIsAbort(ret)) {
		return ret;
	}
	if (
		!treeWalkIsSkip(ret) &&
		!treeWalkIsRemove(ret)
	) {
		var innerPath = [...path, node];
		var innerPathCtx = [...pathCtx, nodeCtx];
		var rc = elAdapter.childCount(nodeElement);
		for (var i = 0; i < rc; i++) {
			var innerRet = treeWalk({
				node: elAdapter.childIndexGet(nodeElement, i),
				elAdapter,
				walkFns,
				path: innerPath,
				pathCtx: innerPathCtx,
				nodeCtx: getNodeCtx(i, rc),
				walkCtx,
			});
			if (treeWalkIsRemove(innerRet)) {
				elAdapter.childSplice(nodeElement, i, 1)
				i--, rc--
			}
			if (treeWalkIsAbort(innerRet)) return innerRet;
		}
	}
	if (onNodeExit) onNodeExit.call(ctx, {...ctx, node, path, elAdapter});
	return ret;
}

export default treeWalk;

export function getFullTreePath(root, testTarget, elAdapter) {
	let targetEntry = null;
	treeWalk({node: root, elAdapter, walkFns: {
		onNode: function(entry) {
			if (testTarget.call(this, entry)) {
				targetEntry = entry;

				return this.abort();
			}
		},
	}});
	return targetEntry;
}
