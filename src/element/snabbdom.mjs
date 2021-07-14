import {arrayConcat} from '../collection.mjs';

const initName = (name) => ({
	_name: name,
	_class: null,
	_id: null,
	sel: name,
	data: {},
	text: void 0, // Snabbdom requires undefined
	children: []
});
const textNode = (text) => ({text:text});
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
const refFragment = {};
const nameComment = '!';

export default ({ attrHandler } = {}) => {
	attrHandler = (attrHandler || attrHandlerDefault).bind(attrFn);
	return {
		isText: (el) => !el.sel && 'string' === typeof el.text,
		isFragment: (el) => el._name === refFragment,
		isComment: (el) => el._name === nameComment,
		isChildren: (ch) => ch instanceof Array,
		initRoot: () => initName(refFragment),
		initName,
		initComment: (text = '') => {var el = initName(nameComment); el.text = text; return el},
		nameGet: (el) => el._name,
		textNode,
		textValueGet: (el) => el.text,
		textValueSet: (el, text) => void (el.text = text),
		attrsAdd: attrHandler,
		attrsEach: (el, handler) => {
			if (el && !el.data) console.log('ElementSnabbdom data not found', el);
			var map = el.data.attrs;
			var hop = Object.prototype.hasOwnProperty;
			if (!map) return;
			var ctx = {
				_break: 1 << 0,
				_remove: 1 << 1
			};
			var keys = [], k;
			for (k in map) if (hop.call(map, k)) keys.push(k);
			for (var i = 0, count = keys.length; i < count; i++) {
				k = keys[i];
				var ret = handler.call(ctx, k, map[k], null, i);
				if (ret & ctx._remove) delete map[k];
				if (ret & ctx._break) break;
			}
		},
		childElement: child,
		childText: (el, text) => child(el, textNode(text)),
		childCount: (el) => el.children.length,
		childIndexGet: (el, index) => el.children[index],
		childSplice: (el, index, remove, add) => el.children.splice(index, remove, ...(add || [])),
		childrenGet: (el) => el.children,
		childrenSet: (el, children) => el.children = children,
		toArray: arrayConcat,
	};
};
