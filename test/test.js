// const assert = require('assert');
// const XMLParser = require('..');
const runner = require('./runner');

if (require.main === module) {
	var test = process.argv[2];
	test = test && runner[test];
	test instanceof Function && test();
}
