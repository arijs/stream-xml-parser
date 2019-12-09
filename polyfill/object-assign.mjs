
export default function ObjectAssign(target) {
	var hop = Object.prototype.hasOwnProperty;
	var argc = arguments.length;
	for (var i = 1; i < argc; i++) {
		var source = arguments[i];
		for (var key in source) {
			if (hop.call(source, key)) {
				target[key] = source[key];
			}
		}
	}
	return target;
}
