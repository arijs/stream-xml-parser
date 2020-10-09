
var STRING = 'string';
var OBJECT = 'object';

function TreeMatcher(elAdapter) {
	this.elAdapter = elAdapter;
	this.clearRules();
}
TreeMatcher.prototype = {
	constructor: TreeMatcher,
	elAdapter: null,
	rulesName: null,
	rulesAttrs: null,
	rulesPath: null,
	defaultNameRepeatMin: 1,
	defaultNameRepeatMax: 1,
	defaultAttrRepeatMin: 1,
	defaultAttrRepeatMax: Infinity,
	reSpace: /^\s+|\s+(?=\s)|\s+$/g,
	reLimit: /^(.*)(?: <(?:([?*+])|(\d*)(,)?(\d*))(\?)?>)$/,
	clearRules: function() {
		this.rulesName = [];
		this.rulesAttrs = [];
		this.rulesPath = [];
	},
	resetRuleMatches: function(rules) {
		var rc = rules.length;
		for (var i = 0; i < rc; i++) {
			rules[i].matches = this.matchInitial();
		}
	},
	resetMatches: function() {
		this.resetRuleMatches(this.rulesName);
		this.resetRuleMatches(this.rulesAttrs);
		this.resetRuleMatches(this.rulesPath);
	},
	strNormalize: function(str) {
		return STRING === typeof str
			? String(str).replace(this.reSpace, '').toLowerCase()
			: str;
	},
	strRaw: function(str) {
		return str;
	},
	getNormalize: function(normalize) {
		return normalize instanceof Function ? normalize : this.strNormalize;
	},
	acceptAll: function() {
		return true;
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
	getMatcherFrom: function(item, opt) {
		if (item instanceof TreeMatcher) return item;
		var tm = new TreeMatcher(this.elAdapter);
		if (STRING === typeof item) {
			tm.name(item, opt && opt.name);
		} else if (OBJECT === typeof item) {
			if (null != item.name) {
				tm.name(item.name, item.opt || opt && opt.name);
			}
			if (item.attrs instanceof Array) {
				tm.attrFromArray(item.attrs, opt && opt.attrs);
			}
		}
		return tm;
	},
	preTest: function(test, normalize) {
		return STRING === typeof test ? normalize(test) : test || this.acceptAll;
	},
	matchInitial: function() {
		return 0;
	},
	matchAddItem: function(matches) {
		return matches + 1;
	},
	matchGetCount: function(matches) {
		return matches;
	},
	matchNameAddValue: function() {},
	matchAttrAddValue: function() {},
	matchPathAddValue: function() {},
	name: function(testName, opt) {
		var normalize = this.getNormalize(opt && opt.normalize);
		var repeatMin = opt && opt.repeatMin;
		var repeatMax = opt && opt.repeatMax;
		testName = this.preTest(testName, normalize);
		var self = this;
		var m = {
			matches: this.matchInitial(),
			repeatMin: +repeatMin === repeatMin ? repeatMin : this.defaultNameRepeatMin,
			repeatMax: +repeatMax === repeatMax ? repeatMax : this.defaultNameRepeatMax,
			test: function(nodeName, node, path) {
				if (self.testValue(testName, normalize(nodeName))) {
					var addVal = self.matchNameAddValue(nodeName, node, path);
					m.matches = self.matchAddItem(m.matches, addVal);
				}
			}
		};
		this.rulesName.push(m);
	},
	attr: function(testAttrName, testAttrValue, opt) {
		var normalize = this.getNormalize(opt && opt.normalize);
		var repeatMin = opt && opt.repeatMin;
		var repeatMax = opt && opt.repeatMax;
		testAttrName = this.preTest(testAttrName, normalize);
		testAttrValue = this.preTest(testAttrValue, normalize);
		var self = this;
		var m = {
			matches: this.matchInitial(),
			repeatMin: +repeatMin === repeatMin ? repeatMin : this.defaultAttrRepeatMin,
			repeatMax: +repeatMax === repeatMax ? repeatMax : this.defaultAttrRepeatMax,
			test: function(attrName, attrValue, node, path) {
				if (
					self.testValue(testAttrName, normalize(attrName)) &&
					self.testValue(testAttrValue, normalize(attrValue))
				) {
					var addVal = self.matchAttrAddValue(attrName, attrValue, node, path);
					m.matches = self.matchAddItem(m.matches, addVal);
				}
			}
		};
		this.rulesAttrs.push(m);
	},
	getAttrTestFromString: function(str) {
		str = String(str || '');
		var eq = str.indexOf('=');
		var name = -1 === eq ? str : str.substr(0, eq);
		var value = -1 === eq ? null : str.substr(eq+1);
		return { name, value };
	},
	attrFromArray: function(list, preOpt) {
		var c = list.length;
		for (var i = 0; i < c; i++) {
			var item = list[i];
			if (STRING === typeof item) {
				item = this.getAttrTestFromString(item);
			}
			if (item instanceof Array) {
				item = item.slice();
				item[2] = OBJECT === typeof preOpt
					? OBJECT === typeof item[2]
						? { ...preOpt, ...item[2] }
						: { ...preOpt }
					: item[2];
				this.attr(item[0], item[1], item[2]);
			} else if (OBJECT === typeof item) {
				item = { ...item };
				item.opt = OBJECT === typeof preOpt
					? OBJECT === typeof item.opt
						? { ...preOpt, ...item.opt }
						: { ...preOpt }
					: item.opt;
				this.attr(item.name, item.value, item.opt);
			}
		}
	},
	pathExact: function(testPath, opt) {
		var tpc = testPath.length;
		for (var i = 0; i < tpc; i++) {
			testPath[i] = this.getMatcherFrom(testPath[i], opt);
		}
		var m = {
			matches: this.matchInitial(),
			test: function(path) {
				// repeatMin, repeatMax
			}
		}
	}
};
