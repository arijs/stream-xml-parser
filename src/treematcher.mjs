import testList from './testlist.mjs';

var STRING = 'string';
var OBJECT = 'object';

export default TreeMatcher;

export function getMatcherFrom(item, elAdapter, opt) {
	if (item instanceof TreeMatcher) return item;
	var tm = new TreeMatcher(elAdapter);
	if (STRING === typeof item) {
		tm.name(item, opt && (opt.name || opt));
	} else if (item instanceof Array) {
		if (null != item[0]) {
			tm.name(item[0], opt && (opt.name || opt));
		}
		if (item[1] instanceof Array) {
			tm.attrFromArray(item[1], opt && (opt.attrs || opt));
		}
		if (item[2] instanceof Array) {
			tm.path(item[2], opt && (opt.path || opt));
		}
		if (OBJECT === typeof item[3]) {
			tm.opt = item[3];
		}
	} else if (OBJECT === typeof item) {
		if (null != item.name) {
			tm.name(item.name, item.nameOpt || opt && (opt.name || opt));
		}
		if (item.attrs instanceof Array) {
			tm.attrFromArray(item.attrs, item.attrsOpt || opt && (opt.attrs || opt));
		}
		if (item.path instanceof Array) {
			tm.path(item.path, item.pathOpt || opt && (opt.path || opt));
		}
		if (OBJECT === typeof item.opt) {
			tm.opt = item.opt;
		}
	}
	return tm;
}

export function getMatcherFromArray(list, elAdapter, opt) {
	var tm = new TreeMatcher(elAdapter);
	tm.subFromArray(list, opt);
	return tm;
}

var reSpace = /^\s+|\s+(?=\s)|\s+$/g;
var reLimit = /^(.*)(?: <(?:([?*+])|(\d*)(,)?(\d*))(\?)?>)$/;
var reAttr = /^([^\s=]+)=(("?).*\3)$/;

export var treeMethod = {
	and: {
		reduce: function(b) {
			return {
				result: b,
				_break: !b
			};
		}
	},
	or: {
		reduce: function(b) {
			return {
				result: b,
				_break: b
			};
		}
	},
	andList: {
		init: function() {
			return {
				and: [],
				not: [],
				success: true
			};
		},
		reduce: function(b, a, {rule}) {
			a[b?'and':'not'].push(rule);
			a.success = a.success && b;
			return {
				result: a,
				_break: !b
			};
		}
	},
	orList: {
		init: function(rules) {
			return {
				yes: [],
				not: [],
				success: rules.length === 0
			};
		},
		reduce: function(b, a, {itemResult}) {
			a[b?'yes':'not'].push(itemResult);
			a.success = b || a.success;
			return {
				result: a,
				_break: b
			};
		}
	},
	orCount: {
		init: function(rules) {
			var count = [], rc = rules.length;
			for (var i = 0; i < rc; i++) count[i] = 0;
			return {
				rules,
				count,
				nomatch: 0,
				success: false
			};
		},
		reduce: function(b, a, {ruleIndex}) {
			if (b) {
				a.count[ruleIndex] += 1;
			} else if (ruleIndex + 1 === a.rules.length) {
				a.nomatch += 1;
			}
			return {
				result: a,
				_break: b
			};
		},
		final: function(result) {
			var rules = result.rules;
			var count = result.count;
			var rc = rules.length;
			var success = true;
			for (var i = 0; i < rc; i++) {
				success = rules[i].repeatMin <= count[i] && count[i] <= rules[i].repeatMax;
				if (!success) break;
			}
			result.success = success;
			return result;
		}
	}
};

export var strPrepare = {
	spaceLower: function(str) {
		return STRING === typeof str
			? String(str).replace(reSpace, '').toLowerCase()
			: str;
	},
	raw: function(str) {
		return str;
	}
};

var defaultOpts = {
	name: {
		repeatMin: 1,
		repeatMax: 1,
		repeatGreedy: false,
		normalizeNodeName: strPrepare.spaceLower,
	},
	attr: {
		repeatMin: 1,
		repeatMax: Infinity,
		repeatGreedy: false,
		normalizeAttrName: strPrepare.spaceLower,
		normalizeAttrValue: strPrepare.spaceLower,
	},
	sub: {
		repeatMin: 1,
		repeatMax: 1,
		repeatGreedy: false,
		testName: true,
		testAttrs: true,
		testPath: true,
	},
};

function TreeMatcher(elAdapter) {
	this.elAdapter = elAdapter;
	this.clearRules();
}
TreeMatcher.from = getMatcherFrom;
TreeMatcher.fromArray = getMatcherFromArray;

TreeMatcher.method = treeMethod;
TreeMatcher.strPrepare = strPrepare;
TreeMatcher.defaultOpts = defaultOpts;

TreeMatcher.prototype = {
	constructor: TreeMatcher,
	elAdapter: null,
	rulesName: null,
	rulesAttrs: null,
	rulesPath: null,
	rulesSub: null,
	opt: null,
	clearRules: function() {
		this.rulesName = [];
		this.rulesAttrs = [];
		this.rulesPath = [];
		this.rulesSub = [];
		this.opt = null;
	},
	getStringOpt: function(str) {
		var mat = String(str).match(reLimit);
		var repeatMin, repeatMax, repeatGreedy;
		if (mat) {
			repeatGreedy = !mat[6];
			switch (mat[2]) {
				case '?': repeatMin = 0, repeatMax = 1; break;
				case '*': repeatMin = 0, repeatMax = Infinity; break;
				case '+': repeatMin = 1, repeatMax = Infinity; break;
				default:
					repeatMin = +mat[3] || 0;
					repeatMax = mat[4]
						? +mat[5] || Infinity
						: repeatMin;
			}
		}
		return {
			str: mat ? mat[1] : str,
			opt: {
				repeatMin,
				repeatMax,
				repeatGreedy
			}
		};
	},
	optExtend: function(target) {
		var tmin, tmax, tgre, source;
		var ac = arguments.length;
		if (STRING === typeof target) {
			target = this.getStringOpt(' '+target).opt;
		}
		for (var i = 1; i < ac; i++) {
			source = arguments[i];
			if (!source) continue;
			if (STRING === typeof source) {
				source = this.getStringOpt(' '+source).opt;
			}
			var sourceKeys = Object.keys(source);
			var skc = sourceKeys.length;
			for (var j = 0; j < skc; j++) {
				var sk = sourceKeys[j];
				switch (sk) {
					case 'repeatMin':
						tmin = source.repeatMin;
						if (+tmin === tmin)
							target.repeatMin = tmin;
						break;
					case 'repeatMax':
						tmax = source.repeatMax;
						if (+tmax === tmax)
							target.repeatMax = tmax;
						break;
					case 'repeatGreedy':
						tgre = target.repeatGreedy;
						if (!!tgre === tgre)
							target.repeatGreedy = tgre;
						break;
					default:
						// target.source = target.source || source.source;
						target[sk] = source[sk];
						break;
				}
			}
		}
		return target;
	},
	getNormalize: function(normalize) {
		return normalize instanceof Function ? normalize : strPrepare.raw;
	},
	acceptAll: function() {
		return true;
	},
	getItemSuccessDefault: function(itemResult) {
		return itemResult;
	},
	getItemSuccessSub: function(itemResult) {
		return itemResult.success;
	},
	testValue: function(test, value) {
		if (test instanceof RegExp) {
			if (test.test(value)) return true;
		} else if (test instanceof Function) {
			if (test(value)) return true;
		} else if (STRING === typeof test) {
			if (test == value) return true;
		}
		return false;
	},
	preTest: function(test, normalize) {
		return STRING === typeof test
			? normalize(test)
			: null == test
			? this.acceptAll
			: test;
	},
	initRule: function(opt, test, getSuccess) {
		var m = {
			repeatMin: null,
			repeatMax: null,
			repeatGreedy: null,
			source: null,
			test: null,
			getSuccess: null
		};
		this.optExtend(m, opt);
		m.test = test;
		m.getSuccess = getSuccess || this.getItemSuccessDefault;
		return m;
	},
	testRuleItem: function(ruleList, item, testRule, method, rrUse) {
		// var rn = this.rulesName;
		var rc = ruleList.length;
		method = method || treeMethod.or;
		var rr = rrUse || {
			result: null,
			_break: false
		};
		if (!rrUse && method.init) {
			rr.result = method.init(ruleList);
		}
		for (var i = 0; i < rc; i++) {
			var rule = ruleList[i];
			var itemResult = testRule(rule, item);
			var itemSuccess = rule.getSuccess(itemResult);
			rr = method.reduce(itemSuccess, rr.result, {
				first: 0 === i,
				rule,
				item,
				itemResult,
				ruleIndex: i
			});
			if (rr._break) break;
		}
		if (!rrUse && method.final) {
			rr.result = method.final(rr.result);
		}
		return rr.result;
	},
	testRuleItemList: function(ruleList, itemList, testRule, method) {
		var ic = itemList.length;
		var rrUse = {
			result: null,
			_break: false
		};
		if (method.init) {
			rrUse.result = method.init(ruleList);
		}
		for (var i = 0; i < ic; i++) {
			rrUse.result = this.testRuleItem(ruleList, itemList[i], testRule, method, rrUse);
		}
		if (method.final) {
			rrUse.result = method.final(rrUse.result);
		}
		return rrUse.result;
	},
	testRuleOrder: function(ruleList, itemList, testAdapter, result) {
		return testList(ruleList, itemList, { testAdapter, result });
	},
	name: function(testName, opt) {
		// opt = {...defaultOpts.name, source: testName, ...opt};
		opt = this.optExtend(
			{},
			defaultOpts.name,
			{ source: testName },
			testName.opt,
			opt
		);
		var normalize = this.getNormalize(opt.normalizeNodeName);
		if ('*' === testName) testName = this.acceptAll;
		testName = this.preTest(testName, normalize);
		var self = this;
		var m = this.initRule(opt, function(nodeName) {
			return self.testValue(testName, normalize(nodeName));
		});
		this.rulesName.push(m);
	},
	testNameRule: function(rule, nodeName) {
		return rule.test(nodeName);
	},
	testNodeName: function(node, method) {
		var nodeName = this.elAdapter.nameGet(node);
		return this.testRuleItem(
			this.rulesName,
			nodeName,
			this.testNameRule,
			method || treeMethod.orList
		);
	},
	getAttrTestFromString: function(testAttr) {
		if (STRING === typeof testAttr) {
			var item = this.getStringOpt(testAttr);
			var opt = item.opt;
			var mat = item.str.match(reAttr);
			var name, value, eq;
			if (mat) {
				name = mat[1];
				value = mat[2];
				if ('"' === mat[3]) value = JSON.parse(value);
			} else {
				eq = str.indexOf('=');
				name = -1 === eq ? str : str.substr(0, eq);
				value = -1 === eq ? null : str.substr(eq+1);
			}
			return { name, value, opt };
		}
		return testAttr;
	},
	getAttrTestFromArray: function(testAttr) {
		if (testAttr instanceof Array) {
			testAttr = {
				name: testAttr[0],
				value: testAttr[1],
				opt: testAttr[2]
			};
		}
		return testAttr;
	},
	getAttrTestFrom: function(testAttr) {
		testAttr = this.getAttrTestFromString(testAttr);
		testAttr = this.getAttrTestFromArray(testAttr);
		return testAttr;
	},
	attr: function(testAttrSrc, opt) {
		var testAttr = this.getAttrTestFrom(testAttrSrc);
		opt = this.optExtend(
			{},
			defaultOpts.attr,
			{source: testAttrSrc},
			testAttr.opt,
			opt
		);
		var normName = this.getNormalize(opt.normalizeAttrName);
		var normValue = this.getNormalize(opt.normalizeAttrValue);
		testAttr.name = this.preTest(testAttr.name, normName);
		testAttr.value = this.preTest(testAttr.value, normValue);
		var self = this;
		var m = this.initRule(opt, function(attr) {
			return (
				self.testValue(testAttr.name, normName(attr.name)) &&
				self.testValue(testAttr.value, normValue(attr.value))
			);
		});
		this.rulesAttrs.push(m);
	},
	attrFromArray: function(list, preOpt) {
		var c = list.length;
		for (var i = 0; i < c; i++) {
			this.attr(list[i], preOpt);
		}
	},
	nodeAttrsToArray: function(node) {
		var list = [];
		this.elAdapter.attrsEach(node, function(name, value) {
			list.push({name, value});
		});
		return list;
	},
	testAttrRule: function(rule, attr) {
		return rule.test(attr);
	},
	testAttrItem: function(attr) {
		return this.testRuleItem(this.rulesAttrs, attr, this.testAttrRule);
	},
	testNodeAttrs: function(node, method) {
		return this.testRuleItemList(
			this.rulesAttrs,
			this.nodeAttrsToArray(node),
			this.testAttrRule,
			method || treeMethod.orCount
		);
	},
	testPathAdapter: function(m, opt) {
		if (!m.rulesName) {
			console.error('rulesName is '+(typeof m.rulesName));
			console.error(m);
		}
		var rName = m.rulesName[0];
		var self = this;
		return {
			min: rName.repeatMin,
			max: rName.repeatMax,
			greedy: rName.repeatGreedy,
			source: opt.source,
			sourceName: rName.source,
			test: function(node) {
				var name = m.testNodeName(node);
				var attrs = m.testNodeAttrs(node);
				var success =
					self.getItemSuccessSub(name) &&
					self.getItemSuccessSub(attrs);
				return {
					success,
					name,
					attrs,
				};
			},
			getSuccess: self.getItemSuccessSub,
		}
	},
	path: function(testPathSrc, opt) {
		var tpc = testPathSrc.length;
		var testPath = [];
		for (var i = 0; i < tpc; i++) {
			testPath[i] = getMatcherFrom(testPathSrc[i], this.elAdapter, opt);
		}
		var self = this;
		opt = this.optExtend({source: testPathSrc}, opt);
		var m = this.initRule(opt, function(path) {
			return self.testRuleOrder(testPath, path, function(m) {
				return self.testPathAdapter(m, opt);
			}, function({success, active, failed, attemptsList}) {
				return {
					success,
					active,
					failedCount: failed.length,
					attemptsCount: attemptsList.length,
				};
			});
		}, this.getItemSuccessSub);
		this.rulesPath.push(m);
	},
	testPathRule: function(rule, path) {
		return rule.test(path);
	},
	testPath: function(path) {
		return this.testRuleItem(
			this.rulesPath,
			path,
			this.testPathRule,
			treeMethod.orList
		);
	},
	testAll: function(testNode, testPath) {
		var name, attr, path, success = false;
		name = this.testNodeName(testNode);
		if (name.success) {
			attr = this.testNodeAttrs(testNode);
			if (attr.success) {
				path = this.testPath(testPath);
				success = path.success;
			}
		}
		return { success, name, attr, path };
	},
	sub: function(testSubSrc, opt) {
		// opt = {...defaultOpts.name, source: testName, ...opt};
		var testSub = getMatcherFrom(testSubSrc, this.elAdapter, opt);
		opt = this.optExtend(
			{},
			defaultOpts.sub,
			{ source: testSubSrc },
			testSub.opt,
			opt
		);
		var m = this.initRule(opt, function({node: testNode, path: testPath}) {
			var success = true;
			var name;
			var attrs;
			var path;
			if (success && m.testName) {
				name = testSub.testNodeName(testNode);
				success = name.success;
			}
			if (success && m.testAttrs) {
				attrs = testSub.testNodeAttrs(testNode);
				success = attrs.success;
			}
			if (success && m.testPath) {
				path = testSub.testPath(testPath);
				success = path.success;
			}
			return {
				name,
				attrs,
				path,
				success,
			};
		}, this.getItemSuccessSub);
		this.rulesSub.push(m);
	},
	subFromArray: function(list, preOpt) {
		var c = list.length;
		for (var i = 0; i < c; i++) {
			this.sub(list[i], preOpt);
		}
	},
	testSubRule: function(rule, sub) {
		return rule.test(sub);
	},
	testNodeSub: function(node, path, method) {
		return this.testRuleItem(
			this.rulesSub,
			{node, path},
			this.testSubRule,
			method || treeMethod.orList
		);
	},
};
