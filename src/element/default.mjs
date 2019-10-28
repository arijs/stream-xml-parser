
export function elementInit() {
	return {};
}

export function Name(key) {
	this.key = key || 'name';
}
Name.prototype.get = function(el) {
	return el[this.key];
};
Name.prototype.set = function(el, name) {
	el[this.key] = name;
};
Name.prototype.init = function(el) {
	el[this.key] = null;
};

export function Attributes(key) {
	this.key = key || 'attrs';
}
Attributes.prototype.add = function(el, attr) {
	el[this.key].push(attr);
};
Attributes.prototype.init = function(el) {
	el[this.key] = [];
};

export function Children(key) {
	this.key = key || 'children';
}
Children.prototype.addElement = function(el, child) {
	el[this.key].push(child);
};
Children.prototype.addText = function(el, text) {
	el[this.key].push(text);
};
Children.prototype.getCount = function(el) {
	return el[this.key].length;
};
Children.prototype.init = function(el) {
	el[this.key] = [];
};
