
export function treeRender(tree, ctx) {
	var {plugins, breadcrumb = []} = ctx;
	var pc = plugins.length, i;
	var tc = tree.length, j;
	var siblingsVars = {}, bcl = [];
	var plugin, node, bc;
	for (j = 0; j < tc; j++) {
		bc = {node: tree[j], index: j, siblings: tree, vars: siblingsVars}
		bcl[j] = [...breadcrumb, bc];
	}
	for (i = 0; i < pc; i++) {
		plugin = plugins[i];
		for (j = 0; j < tc; j++) {
			node = tree[j];
			node = plugin(node, {...ctx, siblingsVars, breadcrumb: bcl[j]});
			if (node) {
				tree[j] = node;
			} else {
				tree.splice(j, 1), j--, tc--;
			}
		}
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
	return function pluginConvertElement(nodeFrom, ctx) {
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
			adapterTo.childrenSet(nodeTo, adapterFrom.childrenGet(nodeFrom));
		}
		return nodeTo;
	};
}
