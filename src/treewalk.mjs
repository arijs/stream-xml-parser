
var _skip = 1;
var _abort = 2;
var _remove = 4;
export var treeWalkIsSkip = ret => ret & _skip;
export var treeWalkIsAbort = ret => ret & _abort;
export var treeWalkIsRemove = ret => ret & _remove;

function treeWalk(node, elAdapter, walkFns, path, pathCtx = []) {
	var ret = 0;
	var ctx = {
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
	if (ret) return ret;
	path = [...path, node];
	var rc = elAdapter.childCount(node);
	for (var i = 0; i < rc; i++) {
		ret = treeWalk(
			elAdapter.childIndexGet(node, i),
			elAdapter,
			walkFns,
			path,
			[...pathCtx, {
				index: i,
				count: rc,
			}]
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
