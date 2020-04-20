
export default (apiDom) => {
	const child = (el, child) => void el.appendChild(child);
	const childCount = (el) => el.childNodes.length;
	const childIndexGet = (el, index) => el.childNodes[index];
	const childSplice = (el, index, remove, add) => {
		//splice.apply(el.childNodes, [index, remove, ...(add || [])]);
		var ec = childCount(el);
		while (remove > 0 && ec > index) {
			el.removeChild(childIndexGet(el, index));
			remove--, ec--;
		}
		var i, c = add.length;
		var temp = []; // Live NodeList changes as we reassign nodes
		for (i = 0; i < c; i++) {
			temp.push(add[i]);
		}
		add = temp;
		for (i = 0; i < c; i++) {
			el.insertBefore(add[i], childIndexGet(el, index + i));
		}
	}
	const textNode = (text) => apiDom.createTextNode(text);
	// const splice = Array.prototype.splice;
	return {
		isText: (el) => el.nodeType === apiDom.TEXT_NODE,
		initRoot: () => apiDom.createDocumentFragment(),
		initName: (name) => apiDom.createElement(name),
		nameGet: (el) => el.nodeName,
		textNode,
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
		childCount,
		childIndexGet: (el, index) => el.childNodes[index],
		childSplice,
		childrenGet: (el) => el.childNodes,
		childrenSet: (el, children) => childSplice(el, 0, childCount(el), children)
	};
};
