import testList from './testlist';

var STRING = 'string';
var OBJECT = 'object';

export default TreeMatcher;

function getMatcherFrom(item, elAdapter, opt) {
	if (item instanceof TreeMatcher) return item;
	var tm = new TreeMatcher(elAdapter);
	if (STRING === typeof item) {
		tm.name(item, opt && opt.name);
	} else if (item instanceof Array) {
		if (null != item[0]) {
			tm.name(item[0], opt && opt.name);
		}
		if (item[1] instanceof Array) {
			tm.attrFromArray(item[1], opt && opt.attrs);
		}
		if (item[2] instanceof Array) {
			tm.path(item[2], opt && opt.path);
		}
	} else if (OBJECT === typeof item) {
		if (null != item.name) {
			tm.name(item.name, item.nameOpt || opt && opt.name);
		}
		if (item.attrs instanceof Array) {
			tm.attrFromArray(item.attrs, item.attrsOpt || opt && opt.attrs);
		}
		if (item.path instanceof Array) {
			tm.path(item.path, item.pathOpt || opt && opt.path);
		}
	}
	return tm;
}

function TreeMatcher(elAdapter) {
	this.elAdapter = elAdapter;
	this.clearRules();
}
TreeMatcher.from = getMatcherFrom;
TreeMatcher.prototype = {
	constructor: TreeMatcher,
	elAdapter: null,
	rulesName: null,
	rulesAttrs: null,
	rulesPath: null,
	defaultName: {
		repeatMin: 1,
		repeatMax: 1,
		repeatGreedy: false
	},
	defaultAttr: {
		repeatMin: 1,
		repeatMax: Infinity,
		repeatGreedy: false
	},
	reSpace: /^\s+|\s+(?=\s)|\s+$/g,
	reLimit: /^(.*)(?: <(?:([?*+])|(\d*)(,)?(\d*))(\?)?>)$/,
	reAttr: /^([^\s=]+)=(("?).*\3)$/,
	clearRules: function() {
		this.rulesName = [];
		this.rulesAttrs = [];
		this.rulesPath = [];
	},
	getStringOpt: function(str) {
		var mat = String(str).match(this.reLimit);
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
			tmin = target.repeatMin;
			tmax = target.repeatMax;
			tgre = target.repeatGreedy;
			source = arguments[i];
			if (!source) continue;
			if (STRING === typeof source) {
				source = this.getStringOpt(' '+source).opt;
			}
			target.repeatMin = +tmin === tmin
				? tmin
				: source.repeatMin;
			target.repeatMax = +tmax === tmax
				? tmax
				: source.repeatMax;
			target.repeatGreedy = !!tgre === tgre
				? tgre
				: source.repeatGreedy;
			target.source = target.source || source.source;
		}
		return target;
	},
	strSpaceLower: function(str) {
		return STRING === typeof str
			? String(str).replace(this.reSpace, '').toLowerCase()
			: str;
	},
	strRaw: function(str) {
		return str;
	},
	getNormalize: function(normalize) {
		return normalize instanceof Function ? normalize : this.strRaw;
	},
	acceptAll: function() {
		return true;
	},
	methodAnd: {
		reduce: function(b) {
			return {
				result: b,
				_break: !b
			};
		}
	},
	methodOr: {
		reduce: function(b) {
			return {
				result: b,
				_break: b
			};
		}
	},
	methodAndList: {
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
	methodOrList: {
		init: function() {
			return {
				yes: [],
				not: [],
				success: false
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
	methodOrCount: {
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
			if (0 != result.nomatch) {
				result.success = false;
				return result;
			}
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
	},
	getItemSuccessDefault: function(itemResult) {
		return itemResult;
	},
	getItemSuccessOrder: function(itemResult) {
		return itemResult.success;
	},
	testValue: function(test, value) {
		if (test instanceof RegExp) {
			if (test.test(value)) return true;
		} else if (test instanceof Function) {
			if (test(value)) return true;
		} else {
			if (String(test) == value) return true;
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
	initRule: function(opt, def, test, getSuccess) {
		var m = {
			repeatMin: null,
			repeatMax: null,
			repeatGreedy: null,
			source: null,
			test: null,
			getSuccess: null
		};
		this.optExtend(m, opt, def);
		m.test = test;
		m.getSuccess = getSuccess || this.getItemSuccessDefault;
		return m;
	},
	testRuleItem: function(ruleList, item, testRule, method, rrUse) {
		// var rn = this.rulesName;
		var rc = ruleList.length;
		method = method || this.methodOr;
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
	testRuleOrder: function(ruleList, itemList, testAdapter) {
		return testList(ruleList, itemList, { testAdapter });
	},
	name: function(testName, opt) {
		var normalize = this.getNormalize(opt && opt.normalizeNodeName);
		if ('*' === testName) testName = this.acceptAll;
		testName = this.preTest(testName, normalize);
		var self = this;
		var def = this.defaultName;
		var m = this.initRule(opt, def, function(nodeName) {
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
			method
		);
	},
	attr: function(testAttr, opt) {
		var normName = this.getNormalize(opt && opt.normalizeAttrName);
		var normValue = this.getNormalize(opt && opt.normalizeAttrValue);
		if (STRING === typeof testAttr) {
			testAttr = this.getAttrTestFromString(testAttr);
			opt = this.optExtend(opt, testAttr.opt);
		} else if (testAttr instanceof Array) {
			opt = this.optExtend(opt, testAttr[2]);
			testAttr = { name: testAttr[0], value: testAttr[1] };
		}
		testAttr.name = this.preTest(testAttr.name, normName);
		testAttr.value = this.preTest(testAttr.value, normValue);
		var self = this;
		var def = this.defaultAttr;
		var m = this.initRule(opt, def, function(attr) {
			return (
				self.testValue(testAttr.name, normName(attr.name)) &&
				self.testValue(testAttr.value, normValue(attr.value))
			);
		});
		this.rulesAttrs.push(m);
	},
	getAttrTestFromString: function(item) {
		item = String(item || '');
		item = this.getStringOpt(item);
		var opt = item.opt;
		var mat = item.str.match(this.reAttr);
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
	},
	attrFromArray: function(list, preOpt) {
		var c = list.length;
		for (var i = 0; i < c; i++) {
			var item = list[i];
			if (STRING === typeof item) {
				item = this.getAttrTestFromString(item);
			}
			if (item instanceof Array) {
				// item = item.slice();
				item[2] = this.optExtend(item[2] || {}, preOpt);
				this.attr({name: item[0], value: item[1]}, item[2]);
			} else if (OBJECT === typeof item) {
				item.opt = this.optExtend(item.opt || {}, preOpt);
				this.attr(item, item.opt);
			}
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
			method || this.methodOrCount
		);
	},
	testPathAdapter: function(m) {
		if (!m.rulesName) {
			console.error('rulesName is '+(typeof m.rulesName));
			console.error(m);
		}
		var rName = m.rulesName[0];
		return {
			min: rName.repeatMin,
			max: rName.repeatMax,
			greedy: rName.repeatGreedy,
			test: function(node) {
				return m.testNodeName(node)
					&& m.testNodeAttrs(node);
			}
		}
	},
	path: function(testPath, opt) {
		var tpc = testPath.length;
		for (var i = 0; i < tpc; i++) {
			testPath[i] = getMatcherFrom(testPath[i], this.elAdapter, opt);
		}
		var self = this;
		var m = this.initRule(null, null, function(path) {
			return self.testRuleOrder(testPath, path, self.testPathAdapter);
		}, this.getItemSuccessOrder);
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
			this.methodOrList
		);
	},
	testAll: function(testNode, testPath) {
		var name, attr, path, success = false;
		name = this.testNodeName(testNode, this.methodOrList);
		if (name.success) {
			attr = this.testNodeAttrs(testNode);
			if (attr.success) {
				path = this.testPath(testPath);
				success = path.success;
			}
		}
		return { success, name, attr, path };
	}
};
