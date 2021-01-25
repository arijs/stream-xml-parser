
export function arrayFrom(val) {
	var slice = Array.prototype.slice;
	switch (true) {
		case val instanceof Array: return val;
		case void 0 == val: return [];
		case isCollection(val): return slice.call(val);
		default: return [val];
	}
}

export function arrayConcat(val) {
	switch (true) {
		case val instanceof Array: return val;
		case void 0 == val: return [];
		default: return [val];
	}
}

export function isCollection(obj) {
	var hop = Object.prototype.hasOwnProperty;
	var propEnum = Object.prototype.propertyIsEnumerable;
	var len, intLen;
	return obj &&
		'length' in obj &&
		!propEnum.call(obj, 'length') &&
		(len = obj.length,
			intLen = parseInt(len),
			intLen === len && intLen >= 0);
}
