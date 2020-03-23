
export default ({
	keyName='name',
	keyAttrs='attrs',
	keyChildren='children'
} = {}) => {
	const initName = (name) => ({
		[keyName]: name,
		[keyAttrs]: [],
		[keyChildren]: []
	});
	const child = (el, child) => void el[keyChildren].push(child);
	const echo = (el) => el;
	return {
		isText: (el) => 'string' === typeof el,
		initRoot: initName,
		initName,
		nameGet: (el) => el[keyName],
		textNode: echo,
		textValueGet: echo,
		attrsAdd: (el, attr) => void el[keyAttrs].push(attr),
		attrsEach: (el, handler) => {
			var list = el[keyAttrs];
			if (!list) console.log('ElementDefault attrs not found', el, keyAttrs);
			var count = list.length;
			for (var i = 0; i < count; i++) {
				var a = list[i];
				if (handler(a.name, a.value, a, i)) break;
			}
		},
		childElement: child,
		childText: child,
		childCount: (el) => el[keyChildren].length,
		childSplice: (el, index, remove, add) => el[keyChildren].splice(index, remove, ...(add || [])),
		childrenGet: (el) => el[keyChildren],
		childrenSet: (el, children) => el[keyChildren] = children
	};
};
