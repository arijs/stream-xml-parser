
var _skip = {};
var _abort = {};

function treeWalk(node, elAdapter, walkFns, path) {
	var ret = undefined;
	var ctx = {
		skip() { ret = _skip; },
		abort() { ret = _abort; },
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
	path = path.concat([node]);
	var rc = elAdapter.childCount(node);
	for (var i = 0; i < rc; i++) {
		ret = treeWalk(
			elAdapter.childIndexGet(node, i),
			elAdapter,
			walkFns,
			path
		);
		if (ret === _abort) return ret;
	}
}

export default treeWalk;
