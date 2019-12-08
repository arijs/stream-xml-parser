
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
	return {
		initRoot: initName,
		initName,
		nameGet: (el) => el[keyName],
		attrsAdd: (el, attr) => void el[keyAttrs].push(attr),
		childElement: child,
		childText: child,
		childCount: (el) => el[keyChildren].length,
		childSplice: (el, index, remove, add) => el[keyChildren].splice(index, remove, ...(add || []))
	};
};
