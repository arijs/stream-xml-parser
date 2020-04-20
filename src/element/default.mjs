
export default ({
	keyName='name',
	keyAttrs='attrs',
	keyChildren='children',
	keyText='text',
	textName='#text',
	rootName='#document-fragment'
} = {}) => {
	const initName = (name) => ({
		[keyName]: name,
		[keyAttrs]: [],
		[keyChildren]: []
	});
	const child = (el, child) => void el[keyChildren].push(child);
	const textNode = (text) => ({[keyName]: textName, [keyText]: text});
	return {
		isText: (el) => textName === el[keyName],
		initRoot: () => initName(rootName),
		initName,
		nameGet: (el) => el[keyName],
		textNode: textNode,
		textValueGet: (el) => el[keyText],
		textValueSet: (el, text) => el[keyText] = text,
		attrsAdd: (el, attr) => void el[keyAttrs].push(attr),
		attrsEach: (el, handler) => {
			var list = el[keyAttrs];
			if (!list) console.log('ElementDefault attrs not found', el, keyAttrs);
			var count = list && list.length || 0;
			for (var i = 0; i < count; i++) {
				var a = list[i];
				if (handler(a.name, a.value, a, i)) break;
			}
		},
		childElement: child,
		childText: (el, text) => child(el, textNode(text)),
		childCount: (el) => el[keyChildren].length,
		childIndexGet: (el, index) => el[keyChildren][index],
		childSplice: (el, index, remove, add) => el[keyChildren].splice(index, remove, ...(add || [])),
		childrenGet: (el) => el[keyChildren],
		childrenSet: (el, children) => el[keyChildren] = children
	};
};
