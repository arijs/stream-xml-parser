
export function elementInit() {
	return {};
}

export const elementName = (key) => {
	key || (key='name');
	return {
		get: (el) => el[key],
		set: (el, name) => void (el[key] = name)
	};
};

export const elementAttributes = (key) => {
	key || (key='attrs');
	return {
		add: (el, attr) => void el[key].push(attr)
	};
};

export const elementChildren = (key) => {
	key || (key='children');
	return {
		addElement: (el, child) => void el[key].push(child),
		addText: (el, text) => void el[key].push(text),
		getCount: (el) => el[key].length
	};
};
