// import {arrayFrom, arrayConcat} from './collection';

export function listToNode(list, adapter) {
	var node = adapter.initRoot();
	adapter.childrenSet(node, list);
	return node;
}

export function treeRenderPlugin(sourceTree, sourceAdapter, ctx, plugin, targetAdapter, createTree, targetTree) {
	if (!ctx) ctx = {};
	if (!targetAdapter) targetAdapter = sourceAdapter;

	var sourceArray = sourceAdapter.isChildren(sourceTree);
	if (sourceArray) sourceTree = listToNode(sourceTree, sourceAdapter);

	if (createTree) targetTree = targetAdapter.initRoot();
	else if (!targetTree) targetTree = sourceTree;
	else if (targetAdapter.isChildren(targetTree)) {
		targetTree = listToNode(targetTree, targetAdapter);
	}

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
		nodeInput = sourceAdapter.childIndexGet(sourceTree, j);
		ctx.getBreadcrumbLast = getBreadcrumbLast;
		ctx.getBreadcrumb = getBreadcrumb;
		nodeOutput = plugin(nodeInput, sourceAdapter, ctx, targetAdapter, createTree, targetTree);
		arrayOutput = targetAdapter.toArray(nodeOutput);
		var nc = arrayOutput.length - 1;
		targetAdapter.childSplice(targetTree, j+jOffset, 1, arrayOutput);
		if (targetTree === sourceTree) {
			j += nc, tc += nc;
		} else {
			jOffset += nc;
		}
	}
	ctx.getBreadcrumb = parentBreadcrumb;
	if (sourceArray) {
		targetTree = targetAdapter.childrenGet(targetTree);
	}
	return targetTree;
}

export function treeRender(sourceTree, sourceAdapter, ctx, plugins) {
	var pc = plugins.length, i;
	for (i = 0; i < pc; i++) {
		var plugin = plugins[i];
		var targetAdapter, createTree, targetTree;
		if (!(plugin instanceof Function)) {
			({plugin, targetAdapter, createTree, targetTree} = plugin);
		}
		sourceTree = treeRenderPlugin(sourceTree, sourceAdapter, ctx, plugin, targetAdapter, createTree, targetTree);
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

// plugin(nodeInput, sourceAdapter, ctx, targetAdapter, createTree);
export function pluginConvertElement(node, adapter, ctx, targetAdapter, createTree) {
	var nodeTo, children;
	if (adapter.isText(node)) {
		nodeTo = targetAdapter.textNode(adapter.textValueGet(node));
	} else {
		nodeTo = targetAdapter.initName(adapter.nameGet(node));
		adapter.attrsEach(node, (name, value, attr) => {
			if (!attr) attr = {name, value};
			targetAdapter.attrsAdd(nodeTo, attr);
		});
		// children = targetAdapter.childrenGet(nodeTo);
		treeRenderPlugin(node, adapter, ctx, pluginConvertElement, targetAdapter, createTree, nodeTo);
		// treeRenderPlugin(children, adapter, ctx, pluginConvertElement, targetAdapter, createTree);
		// treeRenderPlugin(sourceTree, sourceAdapter, ctx, plugin, targetAdapter, createTree) {
	}
	return nodeTo;
}

export function adapterPluginConvertElement(targetAdapter) {
	return plugin;
	function plugin(nodeInput, sourceAdapter, ctx, _, createTree) {
		return pluginConvertElement(nodeInput, sourceAdapter, ctx, targetAdapter, createTree);
	}
}
