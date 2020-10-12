var testList = require('..').testList;

module.exports = function testTestList() {
	var testEven = {
		test: function(x) {
			return 0 === x % 2;
		},
		min: 1,
		max: Infinity,
		greedy: true
	};
	var test10Multiple = {
		test: function(x) {
			return 0 === x % 10;
		},
		min: 1,
		max: 1,
		greedy: false
	};
	var testEvenNot10 = {
		test: function(x) {
			return 10 !== x && 0 === x % 2;
		},
		min: 1,
		max: Infinity,
		greedy: true
	};
	var listTest = [testEven];
	var result;

	result = testList(
		listTest,
		[3572, 256, 1024, 16, 16384, 64, 512, 8096]
	);
	inspectList(result, true, 'TestList should succeed: all numbers even');

	result = testList(
		listTest,
		[3572, 256, 1024, 16, 16384, 63, 511, 8096]
	);
	inspectList(result, false, 'TestList should fail: some numbers odd');

	result = testList(
		listTest,
		[3571, 255, 1023, 15, 16383, 63, 511, 8095]
	);
	inspectList(result, false, 'TestList should fail: all numbers odd');

	listTest = [testEven, test10Multiple, testEven];

	result = testList(
		listTest,
		[3572, 256, 1024, 10, 16384, 64, 512, 8096]
	);
	inspectList(result, true, 'TestList should succeed: even+, 10, even+');

	result = testList(
		listTest,
		[3572, 256, 1024, 16, 16384, 64, 512, 8096]
	);
	inspectList(result, false, 'TestList should fail: no 10 multiple');

	result = testList(
		listTest,
		[3572, 256, 1024, 16, 16384, 64, 512, 8096, 10]
	);
	inspectList(result, false, 'TestList should fail: 10 multiple at end');

	result = testList(
		listTest,
		[10, 3572, 256, 1024, 16, 16384, 64, 512, 8096]
	);
	inspectList(result, false, 'TestList should fail: 10 multiple at beginning');

	listTest = [testEvenNot10, test10Multiple, test10Multiple, testEven];

	result = testList(
		listTest,
		[3572, 256, 1024, 10, 100, 1000, 512, 8096, 10]
	);
	inspectList(result, true, 'TestList should succeed: evenNot10+, 10mul, 10mul, even+');

	result = testList(
		listTest,
		[10, 3572, 256, 1024, 10, 100, 1000, 512, 8096, 10]
	);
	inspectList(result, false, 'TestList should fail: evenNot10+, 10mul, 10mul, even+');

	result = testList(
		listTest,
		[3572, 256, 1024, 10, 102, 1000, 512, 8096, 10]
	);
	inspectList(result, false, 'TestList should fail: evenNot10+, 10mul, 10mul, even+');

	function inspectList(result, expect, testName) {
		if (result.success === expect) {
			console.log('  ✓ ok '+expect+' '+testName);
			return;
		}
		console.log('  <!> FAIL '+result.success+' '+testName);
		console.log(result);
		var list = result && result.active && result.active.matches;
		var c = list && list.length || 0;
		for (var i = 0; i < c; i++) {
			console.log(i, list[i]);
		}
	}
};
