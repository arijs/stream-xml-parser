
export function treeRenderPlugin(tree, ctx, plugin) {
	var tc = tree.length, j, node;
	var parentVars = ctx.siblingsVars;
	var parentBreadcrumb = ctx.getBreadcrumb;
	var siblingsVars = {};
	var getBreadcrumb = function() {
		var par = parentBreadcrumb && parentBreadcrumb();
		var bc = {
			node: tree[j],
			index: j,
			siblings: tree,
			vars: siblingsVars
		};
		return par ? [...par, bc] : [bc];
	};
	for (j = 0; j < tc; j++) {
		node = tree[j];
		ctx.siblingsVars = siblingsVars;
		ctx.getBreadcrumb = getBreadcrumb;
		node = plugin(node, ctx);
		if (node instanceof Array) {
			var nc = node.length - 1;
			tree.splice.apply(tree, [j, 1, ...node]), j+=nc, tc+=nc;
		} else if (node) {
			tree[j] = node;
		} else {
			tree.splice(j, 1), j--, tc--;
		}
	}
	ctx.siblingsVars = parentVars;
	ctx.getBreadcrumb = parentBreadcrumb;
	return tree;
}

export function treeRender(tree, ctx, plugins) {
	var pc = plugins.length, i;
	for (i = 0; i < pc; i++) {
		tree = treeRenderPlugin(tree, ctx, plugins[i]);
	}
	return tree;
}

export function pluginChildren(node, ctx) {
	var ea = ctx.elAdapter;
	if (!ea.isText(node)) {
		var tree = ea.childrenGet(node);
		if (tree) ea.childrenSet(node, treeRender(tree, ctx));
	}
	return node;
}

export function adapterPluginAttr(handler, resultNode) {
	return function pluginAttr(node, ctx) {
		elAdapter.attrsEach(node, (name, value, attr, index) => {
			handler(name, value, node, ctx, attr, index)
		});
		return resultNode ? resultNode(node, ctx) : node;
	};
}

export function adapterPluginConvertElement(adapterTo) {
	var pluginSelf = function pluginConvertElement(nodeFrom, ctx) {
		var adapterFrom = ctx.elAdapter;
		var nodeTo;
		if (adapterFrom.isText(nodeFrom)) {
			nodeTo = adapterTo.textNode(adapterFrom.textValueGet(nodeFrom));
		} else {
			nodeTo = adapterTo.initName(adapterFrom.nameGet(nodeFrom));
			adapterFrom.attrsEach(nodeFrom, (name, value, attr) => {
				if (!attr) attr = {name, value};
				adapterTo.attrsAdd(nodeTo, attr);
			});
			adapterTo.childrenSet(nodeTo, treeRenderPlugin(
				adapterFrom.childrenGet(nodeFrom), ctx, pluginSelf
			));
		}
		return nodeTo;
	};
	return pluginSelf;
}
