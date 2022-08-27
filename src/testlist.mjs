
export default testList;

function defaultTestAdapter (x) {
	return x;
}
function defaultGroupListInit () {
	return [];
}
function defaultGroupInit (test, testSrc) {
	return {
		test: test,
		testSrc: testSrc,
		matches: []
	};
}
function defaultGroupAdd (group, groupList) {
	groupList.push(group);
}
function defaultGroupGetCount(group) {
	return group.matches.length;
}
function defaultMatchAdd (result, item, group, test, testSrc) {
	if (group.testSrc !== testSrc) {
		console.error(test, '!==', group.test);
		throw new Error('Object "test" in group is not same than "test" added from match');
	}
	group.matches.push({result, item});
}
function defaultResult(result) {
	return result;
}

function testList(testList, itemList, {
	groupListInit = defaultGroupListInit,
	groupInit = defaultGroupInit,
	groupAdd = defaultGroupAdd,
	groupGetCount = defaultGroupGetCount,
	matchAdd = defaultMatchAdd,
	testAdapter = defaultTestAdapter,
	result = defaultResult,
} = {}) {
	var testSrc, test, item, active, testGroup, testResult, testSuccess;
	var activeTest, activeList, activeMatches, newAttempt;
	var active = {
		testList: testList.slice(),
		itemList: itemList.slice(),
		matches: groupListInit(),
		nextGroup: null,
		forked: false
	}
	var attemptsList = [active];
	var failed = [];
	var activeCount = 1;
	while (activeCount) {
		active = attemptsList[0];
		activeTest = active.testList;
		activeList = active.itemList;
		activeMatches = active.matches;
		if (!activeTest.length) {
			if (!activeList.length) {
				return result({
					success: true,
					active,
					failed,
					attemptsList
				});
			} else {
				failBranch();
				continue;
			}
		}
		testSrc = activeTest.shift();
		test = testAdapter(testSrc);
		testGroup = active.nextGroup;
		if (!testGroup) {
			testGroup = groupInit(test, testSrc);
			groupAdd(testGroup, activeMatches);
		}
		active.nextGroup = null;
		if (0 == activeList.length) {
			if (groupGetCount(testGroup) < test.min) {
				failBranch();
			}
			continue;
		}
		if (groupGetCount(testGroup) === test.max) {
			continue;
		}
		if (groupGetCount(testGroup) >= test.min && !active.forked) {
			newAttempt = {
				testList: activeTest.slice(),
				// testList: [testSrc].concat(activeTest),
				itemList: activeList.slice(),
				matches: activeMatches.slice(),
				nextMatch: null,
				forked: false
			};
			attemptsList.splice(test.greedy ? 1 : 0, 0, newAttempt);
			activeCount++;
			activeTest.unshift(testSrc);
			active.nextGroup = testGroup;
			active.forked = true;
			newAttempt = void 0;
			continue;
		}
		active.forked = false;
		item = activeList.shift();
		testResult = test.test(item);
		testSuccess = test.getSuccess instanceof Function
			? test.getSuccess(testResult)
			: testResult;
		if (testSuccess) {
			matchAdd(testResult, item, testGroup, test, testSrc);
			activeTest.unshift(testSrc);
			active.nextGroup = testGroup;
		} else {
			failBranch();
		}
	}
	return result({
		success: 0 === failed.length,
		active,
		failed,
		attemptsList
	});
	function failBranch() {
		failed.push(active);
		active = null;
		attemptsList.shift();
		activeCount--;
	}
}
