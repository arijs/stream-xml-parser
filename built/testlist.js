"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = testList;
function defaultTestAdapter(x) {
    return x;
}
function defaultGroupListInit() {
    return [];
}
function defaultGroupInit(test) {
    return {
        test: test,
        matches: []
    };
}
function defaultGroupAdd(group, groupList) {
    groupList.push(group);
}
function defaultGroupGetCount(group) {
    return group.matches.length;
}
function defaultMatchAdd(result, item, group, test) {
    if (group.test !== test) {
        console.error(test, '!==', group.test);
        throw new Error('Object "test" in group is not same than "test" added from match');
    }
    group.matches.push({ result: result, item: item });
}
function testList(testList, itemList, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.groupListInit, groupListInit = _c === void 0 ? defaultGroupListInit : _c, _d = _b.groupInit, groupInit = _d === void 0 ? defaultGroupInit : _d, _e = _b.groupAdd, groupAdd = _e === void 0 ? defaultGroupAdd : _e, _f = _b.groupGetCount, groupGetCount = _f === void 0 ? defaultGroupGetCount : _f, _g = _b.matchAdd, matchAdd = _g === void 0 ? defaultMatchAdd : _g, _h = _b.testAdapter, testAdapter = _h === void 0 ? defaultTestAdapter : _h;
    var testSrc, test, item, active, testGroup, testResult;
    var activeTest, activeList, activeMatches, newAttempt;
    var active = {
        testList: testList.slice(),
        itemList: itemList.slice(),
        matches: groupListInit(),
        nextGroup: null,
        forked: false
    };
    var attemptsList = [active];
    var failed = [];
    var activeCount = 1;
    while (activeCount) {
        active = attemptsList[0];
        activeTest = active.testList;
        activeList = active.itemList;
        activeMatches = active.matches;
        if (!activeTest.length) {
            return result(0 == activeList.length);
        }
        testSrc = activeTest.shift();
        test = testAdapter(testSrc);
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
            activeTest.unshift(testSrc);
            active.nextGroup = testGroup;
            active.forked = true;
            newAttempt = void 0;
            continue;
        }
        active.forked = false;
        item = activeList.shift();
        testResult = test.test(item);
        if (testResult) {
            matchAdd(testResult, item, testGroup, test, testSrc);
            activeTest.unshift(testSrc);
            active.nextGroup = testGroup;
        }
        else {
            failBranch();
        }
    }
    return result(false);
    function failBranch() {
        failed.push(active);
        active = null;
        attemptsList.shift();
        activeCount--;
    }
    function result(success) {
        return {
            success: success,
            active: active,
            failed: failed,
            attemptsList: attemptsList
        };
    }
}
