import {arrayConcat} from '../collection';

export default ({
	keyName='name',
	keyAttrs='attrs',
	keyChildren='children',
	keyText='text',
	textName='#text',
	rootName='#document-fragment',
	commentName='#comment',
} = {}) => {
	const initName = (name) => ({
		[keyName]: name,
		[keyAttrs]: [],
		[keyChildren]: [],
		[keyText]: null,
	});
	const child = (el, child) => void el[keyChildren].push(child);
	const textNode = (text) => ({[keyName]: textName, [keyText]: text});
	return {
		isText: (el) => textName === el[keyName],
		isFragment: (el) => el[keyName] === rootName,
		isComment: (el) => el[keyName] === commentName,
		initRoot: () => initName(rootName),
		initName,
		initComment: (text = '') => (el = initName(commentName), el[keyText] = text, el),
		nameGet: (el) => el[keyName],
		textNode: textNode,
		textValueGet: (el) => el[keyText],
		textValueSet: (el, text) => el[keyText] = text,
		attrsAdd: (el, attr) => void el[keyAttrs].push(attr),
		attrsEach: (el, handler) => {
			var list = el[keyAttrs];
			if (!list) console.log('ElementDefault attrs not found', el, keyAttrs);
			var count = list && list.length || 0;
			var ctx = {
				_break: 1 << 0,
				_remove: 1 << 1
			};
			for (var i = 0; i < count; i++) {
				var a = list[i];
				var ret = handler(a.name, a.value, a, i);
				if (ret & ctx._remove) list.splice(i, 1), i--, count--;
				if (ret & ctx._break) break;
			}
		},
		childElement: child,
		childText: (el, text) => child(el, textNode(text)),
		childCount: (el) => el[keyChildren].length,
		childIndexGet: (el, index) => el[keyChildren][index],
		childSplice: (el, index, remove, add) => el[keyChildren].splice(index, remove, ...(add || [])),
		childrenGet: (el) => el[keyChildren],
		childrenSet: (el, children) => el[keyChildren] = children,
		toArray: arrayConcat,
	};
};
