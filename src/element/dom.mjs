
export default (apiDom) => {
	const child = (el, child) => void el.appendChild(child);
	const childCount = (el) => el.childNodes.length;
	const childSplice = (el, index, remove, add) => splice.apply(el.childNodes, [index, remove, ...(add || [])]);
	const textNode = (text) => apiDom.createTextNode(text);
	const splice = Array.prototype.splice;
	return {
		isText: (el) => el.nodeType === apiDom.TEXT_NODE,
		initRoot: () => apiDom.createDocumentFragment(),
		initName: (name) => apiDom.createElement(name),
		nameGet: (el) => el.nodeName,
		textNode: textNode,
		textValueGet: (el) => el.nodeValue,
		textValueSet: (el, text) => void (el.nodeValue = text),
		attrsAdd: (el, attr) => el.setAttribute(attr.name, attr.value),
		attrsEach: (el, handler) => {
			var list = el.attributes;
			if (!list) console.log('ElementDom attrs not found', el);
			var count = list.length;
			for (var i = 0; i < count; i++) {
				var a = list[i];
				if (handler(a.name, a.value, a, i)) break;
			}
		},
		childElement: child,
		childText: (el, text) => child(el, textNode(text)),
		childCount: childCount,
		childIndexGet: (el, index) => el.childNodes[index],
		childSplice: childSplice,
		childrenGet: (el) => el.childNodes,
		childrenSet: (el, children) => childSplice(el, 0, childCount(el), children)
	};
};
