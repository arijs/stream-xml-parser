
export default ({ attrHandler } = {}) => {
	const initName = (name) => ({
		_name: name,
		_class: null,
		_id: null,
		sel: name,
		data: {},
		children: []
	});
	const child = (el, child) => void el.children.push(child);
	const attrIdSel = (attr, el) => {
		if (attr.name === 'id') {
			el._id = attr.value;
			attrUpdateSel(el);
			return true;
		}
	};
	const attrClassSel = (attr, el) => {
		if (attr.name === 'class') {
			el._class = attr.value;
			attrUpdateSel(el);
			return true;
		}
	};
	const attrUpdateSel = (el) => {
		const c = el._class;
		const i = el._id;
		el.sel = el._name +
			(i ? '#' + i : '') +
			(c ? '.' + c.replace(/\s+/g,'.') : '');
	};
	const attrObject = (attr, el, key) => {
		let ea = el.data[key];
		if (!ea) el.data[key] = ea = {};
		ea[attr.name] = attr.value;
		return true;
	};
	const attrHandlerDefault = (el, attr) => {
		return attrIdSel(attr, el)
			|| attrClassSel(attr, el)
			|| attrObject(attr, el, 'attrs');
	};
	const attrFn = {
		attrIdSel,
		attrClassSel,
		attrUpdateSel,
		attrObject,
		attrHandlerDefault
	};
	attrHandler = (attrHandler || attrHandlerDefault).bind(attrFn);
	return {
		initRoot: initName,
		initName,
		nameGet: (el) => el._name,
		attrsAdd: attrHandler,
		childElement: child,
		childText: (el, text) => child(el, {text:text}),
		childCount: (el) => el.children.length,
		childSplice: (el, index, remove, add) => el.children.splice(index, remove, ...(add || []))
	};
};
