
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

function treeWalk(node, elAdapter, walkFns, path = [], pathCtx = [], nodeCtx = null) {
	var ret = 0;
	var ctx = {
		nodeCtx,
		pathCtx,
		skip() { ret |= _skip; },
		abort() { ret |= _abort; },
		remove() { ret |= _remove; },
	};
	var {onNode, onText, onComment, onDeclaration, onInstruction} = walkFns;
	if (elAdapter.isText(node)) {
		if (onText) onText.call(ctx, node, path, elAdapter);
		return ret;
	} else if (elAdapter.isComment(node)) {
		if (onComment) onComment.call(ctx, node, path, elAdapter);
		return ret;
	} else if (elAdapter.isDeclaration(node)) {
		if (onDeclaration) onDeclaration.call(ctx, node, path, elAdapter);
		return ret;
	} else if (elAdapter.isInstruction(node)) {
		if (onInstruction) onInstruction.call(ctx, node, path, elAdapter);
		return ret;
	}
	if (!(path instanceof Array)) path = [];
	if (onNode) onNode.call(ctx, node, path, elAdapter);
	if (
		treeWalkIsSkip(ret) ||
		treeWalkIsAbort(ret) ||
		treeWalkIsRemove(ret)
	) return ret;
	path = [...path, node];
	pathCtx = [...pathCtx, nodeCtx];
	var rc = elAdapter.childCount(node);
	for (var i = 0; i < rc; i++) {
		const nodeCtx = getNodeCtx(i, rc);
		ret = treeWalk(
			elAdapter.childIndexGet(node, i),
			elAdapter,
			walkFns,
			path,
			pathCtx,
			nodeCtx,
		);
		if (treeWalkIsRemove(ret)) {
			elAdapter.childSplice(node, i, 1)
			i--, rc--
		}
		if (treeWalkIsAbort(ret)) return ret;
		ret = 0;
	}
	return ret;
}

export default treeWalk;

export function getFullTreePath(root, testTarget, elAdapter) {
	let targetNode = null, targetPath = null;
	treeWalk(root, elAdapter, {
		onNode: function(node, path) {
			if (testTarget({ node, path, pathCtx: this.pathCtx, nodeCtx: this.nodeCtx })) {
				targetPath = [];

				var pathCtx = this.pathCtx;
				for (var i = 0; i < path.length; i++) {
					// var pathNode = path[i];
					// var parentNode = i > 0 ? path[i - 1] : null;
					// var ctxItem = pathCtx[i];
					// targetPath.push(buildPathEntry(pathNode, parentNode, ctxItem));
					targetPath.push(buildNodeEntryFromPath(path, pathCtx, i));
				}
				targetNode = buildNodeEntry(node, path[path.length - 1], this.nodeCtx);

				return this.abort();
			}
		},
	}, []);
	return { node: targetNode, path: targetPath };
	function buildPathEntry(node, parentNode, ctxItem) {
		var childIndexInParent = ctxItem ? ctxItem.index : null;
		var childCountInParent = ctxItem ? ctxItem.count : null;
		return {
			node,
			parentNode,
			childIndex: childIndexInParent,
			childCount: childCountInParent,
		};
	}
}