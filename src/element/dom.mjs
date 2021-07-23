import {arrayFrom, arrayConcat} from '../collection.mjs';

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
	const isFragment = (el) => el.nodeType === apiDom.DOCUMENT_FRAGMENT_NODE;
	const isComment = (el) => el.nodeType === apiDom.COMMENT_NODE;
	const isChildren = (ch) => ch && ch.constructor === apiDom.childNodes.constructor;
	// const splice = Array.prototype.splice;
	return {
		isText: (el) => el.nodeType === apiDom.TEXT_NODE,
		isFragment,
		isComment,
		isChildren,
		initRoot: () => apiDom.createDocumentFragment(),
		initName: (name) => apiDom.createElement(name),
		initComment: (text = '') => apiDom.createComment(text),
		nameGet: (el) => el.nodeName,
		textNode,
		textValueGet: (el) => el.nodeValue,
		textValueSet: (el, text) => void (el.nodeValue = text),
		attrsAdd: (el, attr) => el.setAttribute(attr.name, attr.value),
		attrsEach: (el, handler) => {
			var list = el.attributes;
			// if (!list) console.log('ElementDom attrs not found', el);
			var ctx = {
				_break: 1 << 0,
				_remove: 1 << 1
			};
			var count = list && list.length || 0;
			for (var i = 0; i < count; i++) {
				var a = list[i];
				var ret = handler.call(ctx, a.name, a.value, a, i);
				if (ret & ctx._remove) el.removeAttribute(a.name);
				if (ret & ctx._break) break;
			}
		},
		childElement: child,
		childText: (el, text) => child(el, textNode(text)),
		childCount,
		childIndexGet: (el, index) => el.childNodes[index],
		childSplice,
		childrenGet: (el) => el.childNodes,
		childrenSet: (el, children) => childSplice(el, 0, childCount(el), children),
		toArray: (el) => {
			return !el ? [] :
				isFragment(el) ? arrayFrom(el.childNodes) :
				el.constructor === apiDom.childNodes.constructor ? arrayFrom(el) :
				arrayConcat(el);
		}
	};
};
