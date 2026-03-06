import {arrayFrom, arrayConcat} from '../collection.mjs';

export default (apiDom) => {
	// @remote-dom/polyfill does not define these constants
	// so we define them here manually
	// other dom implementations for the server could have the same constraint
	const
		ELEMENT_NODE = 1,
		ATTRIBUTE_NODE = 2,
		TEXT_NODE = 3,
		CDATA_SECTION_NODE = 4,
		PROCESSING_INSTRUCTION_NODE = 7,
		COMMENT_NODE = 8,
		DOCUMENT_NODE = 9,
		DOCUMENT_TYPE_NODE = 10,
		DOCUMENT_FRAGMENT_NODE = 11,
		ENTITY_REFERENCE_NODE = 5,
		ENTITY_NODE = 6,
		NOTATION_NODE = 12;
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
	const isFragment = (el) => el.nodeType === DOCUMENT_FRAGMENT_NODE;
	const isComment = (el) => el.nodeType === COMMENT_NODE;
	const isChildren = (ch) => ch && ch.constructor === apiDom.childNodes.constructor;
	// const splice = Array.prototype.splice;
	return {
		isText: (el) => el.nodeType === TEXT_NODE,
		isFragment,
		isComment,
		isDeclaration: (el) => el.nodeType === NOTATION_NODE,
		isInstruction: (el) => el.nodeType === PROCESSING_INSTRUCTION_NODE,
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
				var a = list[i] || list.item(i);
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
