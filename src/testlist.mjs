
export default testList;

function defaultGroupListInit () {
	return [];
}
function defaultGroupInit (test) {
	return {
		test: test,
		matches: []
	};
}
function defaultGroupAdd (group, groupList) {
	groupList.push(group);
}
function defaultGroupGetCount(group) {
	return group.matches.length;
}
function defaultMatchAdd (test, result, item, group) {
	if (group.test !== test) {
		console.error(test, '!==', group.test);
		throw new Error('Object "test" in group is not same than "test" added from match');
	}
	group.matches.push({result, item});
}
function defaultTestMatchesInit (testList, matchesListInit, matchGroupAdd, matchesGroupListInit) {
	var c = testList.length;
	var testMatches = matchesGroupListInit();
	for (var i = 0; i < c; i++) {
		matchGroupAdd(testList[i], matchesListInit(), testMatches);
	}
	return testMatches;
}

function testList(testList, itemList, {
	groupListInit = defaultGroupListInit,
	groupInit = defaultGroupInit,
	groupAdd = defaultGroupAdd,
	groupGetCount = defaultGroupGetCount,
	matchAdd = defaultMatchAdd
} = {}) {
	var test, item, active, testGroup, testMM, newAttempt, testResult;
	var activeTest, activeList, activeMatches;
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
	// active.matches = testMatchesInit(active.testList, matchesListInit, matchGroupAdd, matchesGroupListInit);
	while (activeCount) {
		active = attemptsList[0];
		activeTest = active.testList;
		activeList = active.itemList;
		activeMatches = active.matches;
		if (!activeTest.length) {
			return result(0 == activeList.length, 1);
		}
		test = activeTest.shift();
		testGroup = active.nextGroup;
		if (!testGroup) {
			testGroup = groupInit(test);
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
				itemList: activeList.slice(),
				matches: activeMatches.slice(),
				nextMatch: null,
				forked: false
			};
			attemptsList.splice(test.greedy ? 1 : 0, 0, newAttempt);
			activeCount++;
			activeTest.unshift(test);
			active.nextGroup = testGroup;
			active.forked = true;
			newAttempt = void 0;
			continue;
		}
		active.forked = false;
		item = activeList.shift();
		testResult = test.test(item);
		if (testResult) {
			matchAdd(test, testResult, item, testGroup);
			activeTest.unshift(test);
			active.nextGroup = testGroup;
		} else {
			failBranch();
		}
	}
	return result(false, 2);
	function failBranch() {
		failed.push(active);
		active = null;
		attemptsList.shift();
		activeCount--;
	}
	function result(success) {
		return {
			success,
			active,
			failed,
			attemptsList
		};
	}
}
