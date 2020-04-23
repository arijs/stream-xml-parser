import {arrayFrom, arrayConcat} from './collection';

export function treeRenderPlugin(sourceTree, sourceAdapter, ctx, plugin, targetAdapter, createTree) {
	if (!ctx) ctx = {};
	if (!targetAdapter) targetAdapter = sourceAdapter;
	// if (!targetTree) targetTree = sourceTree;
	var targetTree = createTree
		? targetAdapter.initRoot()
		: sourceTree;
	// var tc = tree.length;
	var tc = sourceAdapter.childCount(sourceTree);
	var nodeInput, nodeOutput, arrayOutput, j, jOffset = 0;
	var {getBreadcrumb: parentBreadcrumb} = ctx;
	var getBreadcrumbLast = function() {
		return {
			// node: tree[j],
			index: j,
			indexOffset: jOffset,
			indexTarget: j+jOffset,
			node: sourceAdapter.childIndexGet(sourceTree, j),
			parent: sourceTree,
			parentTarget: targetTree,
		};
	};
	var getBreadcrumb = function() {
		var par = parentBreadcrumb && parentBreadcrumb();
		var last = getBreadcrumbLast();
		return par ? [...par, last] : [last];
	};
	for (j = 0; j < tc; j++) {
		// node = tree[j];
		nodeInput = sourceAdapter.childIndexGet(sourceTree, j);
		ctx.getBreadcrumbLast = getBreadcrumbLast;
		ctx.getBreadcrumb = getBreadcrumb;
		nodeOutput = plugin(nodeInput, sourceAdapter, ctx, targetAdapter, createTree);
		arrayOutput = targetAdapter.toArray(nodeOutput);
		// if (targetAdapter.isFragment(nodeOutput)) {
		// 	nodeOutput = targetAdapter.childrenGet(nodeOutput);
		// 	arrayOutput = arrayFrom(nodeOutput);
		// } else {
		// 	arrayOutput = arrayConcat(nodeOutput);
		// }
		// if (node instanceof Array) {
			var nc = arrayOutput.length - 1;
			// splice.apply(tree, [j, 1, ...node]), j+=nc, tc+=nc;
			targetAdapter.childSplice(targetTree, j+jOffset, 1, arrayOutput);
			if (targetTree === sourceTree) {
				j += nc, tc += nc;
			} else {
				jOffset += nc;
			}
		// } else if (node) {
		// 	// tree[j] = node;
		// 	targetAdapter.childSplice(targetTree, j+jOffset, 1, [node]);
		// } else {
		// 	// tree.splice(j, 1), j--, tc--;
		// 	targetAdapter.childSplice(targetTree, j+jOffset, 1, []);
		// 	if (targetTree === sourceTree) {
		// 		j--, tc--;
		// 	} else {
		// 		jOffset--;
		// 	}
		// }
	}
	ctx.getBreadcrumb = parentBreadcrumb;
	return targetTree;
}

export function treeRender(sourceTree, sourceAdapter, ctx, plugins) {
	var pc = plugins.length, i;
	for (i = 0; i < pc; i++) {
		var plugin = plugins[i];
		var targetAdapter, createTree;
		if (!(plugin instanceof Function)) {
			({plugin, targetAdapter, targetTree} = plugin);
		}
		sourceTree = treeRenderPlugin(sourceTree, sourceAdapter, ctx, plugin, targetAdapter, createTree);
		if (targetAdapter) sourceAdapter = targetAdapter;
	}
	return sourceTree;
}

export function pluginListChildren(node, adapter, ctx, plugins) {
	if (!adapter.isText(node)) {
		var tree = adapter.childrenGet(node);
		if (tree) adapter.childrenSet(node, treeRender(tree, adapter, ctx, plugins));
	}
	return node;
}

export function pluginChildren(node, adapter, ctx, plugin, createTree) {
	if (!adapter.isText(node)) {
		var tree = adapter.childrenGet(node);
		if (tree) adapter.childrenSet(node, treeRenderPlugin(tree, adapter, ctx, plugin, targetAdapter, createTree));
	}
	return node;
}

export function pluginAttr(node, adapter, ctx, attrHandler, resultNode) {
	adapter.attrsEach(node, (name, value, attr, index) => {
		attrHandler(name, value, node, ctx, attr, index)
	});
	return resultNode ? resultNode(node, ctx) : node;
}

export function pluginConvertElement(node, adapter, ctx, targetAdapter) {
	var nodeTo, children;
	if (adapter.isText(node)) {
		nodeTo = targetAdapter.textNode(adapter.textValueGet(node));
	} else {
		nodeTo = targetAdapter.initName(adapter.nameGet(node));
		adapter.attrsEach(node, (name, value, attr) => {
			if (!attr) attr = {name, value};
			targetAdapter.attrsAdd(nodeTo, attr);
		});
		children = targetAdapter.childrenGet(nodeTo);
		treeRenderPlugin(node, adapter, ctx, pluginConvertElement, children, targetAdapter);
	}
	return nodeTo;
}
