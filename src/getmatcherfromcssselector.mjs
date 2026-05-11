import * as cspLib from 'css-selector-parser';
import { getMatcherFrom, getMatcherFromArray } from './treematcher.mjs';

var STRING = 'string';
var ANY_GAP = '* <*>';
var parseCssSelector;

function getCssSelectorParser(selector) {
	if (undefined === parseCssSelector) {
		// Only try to access the 'createParser' method when we actually need it, to allow for better tree shaking in environments where the CSS selector parsing functionality is not used.
		parseCssSelector = cspLib.createParser();
	}
	return parseCssSelector(selector);
}

export default getMatcherFromCssSelector;

export function getMatcherFromCssSelector(selector, elAdapter, opt) {
	if (STRING !== typeof selector || '' === selector.trim()) {
		throw new Error('getMatcherFromCssSelector expects a non-empty selector string');
	}
	var ast;
	try {
		ast = getCssSelectorParser(selector);
	} catch (err) {
		throw new Error('Invalid CSS selector: ' + err.message);
	}
	if (!ast || 'Selector' !== ast.type || !(ast.rules instanceof Array)) {
		throw new Error('Invalid CSS selector AST');
	}
	var compiled = [];
	for (var i = 0; i < ast.rules.length; i++) {
		compiled.push(compileRuleChain(ast.rules[i]));
	}
	if (1 === compiled.length) {
		return getMatcherFrom(compiled[0], elAdapter, opt);
	}
	return getMatcherFromArray(compiled, elAdapter, opt);
}

function compileRuleChain(rule) {
	var chain = flattenRuleChain(rule);
	if (!chain.length) {
		throw new Error('Unsupported selector: empty rule chain');
	}

	var right = compileCompound(chain[chain.length - 1].items);
	var targetEntry = {
		compound: right,
		pathCombinator: null,
		prevSibling: [],
		hasPrevSiblingConstraint: false,
	};

	var ancestorsNearToFar = [];
	var compiledByChainIndex = {};
	compiledByChainIndex[chain.length - 1] = targetEntry;

	for (var i = chain.length - 2; i >= 0; i--) {
		var left = compileCompound(chain[i].items);
		var comb = chain[i + 1].combinator || ' ';
		var rightEntry = compiledByChainIndex[i + 1];

		if ('+' === comb || '~' === comb) {
			if (!rightEntry) {
				throw new Error('Unsupported selector: invalid sibling combinator placement');
			}
			rightEntry.hasPrevSiblingConstraint = true;
			if ('~' === comb) {
				rightEntry.prevSibling.push(ANY_GAP);
			}
			rightEntry.prevSibling.push(asSiblingExact(left));
			continue;
		}

		if (' ' !== comb && '>' !== comb) {
			throw new Error('Unsupported selector combinator: ' + comb);
		}

		var entry = {
			compound: left,
			pathCombinator: comb,
			prevSibling: [],
			hasPrevSiblingConstraint: false,
		};
		ancestorsNearToFar.push(entry);
		compiledByChainIndex[i] = entry;
	}

	var out = asMatcherInput(targetEntry.compound);
	if (targetEntry.hasPrevSiblingConstraint) {
		if (targetEntry.prevSibling.length) out.prevSibling = targetEntry.prevSibling.slice();
		out.prevSibling.push(ANY_GAP);
	}

	if (ancestorsNearToFar.length) {
		var path = [ANY_GAP];
		var ancestorsFarToNear = ancestorsNearToFar.slice().reverse();
		for (var j = 0; j < ancestorsFarToNear.length; j++) {
			var ancestor = ancestorsFarToNear[j];
			var pathItem = asMatcherInput(ancestor.compound);
			if (ancestor.hasPrevSiblingConstraint) {
				if (STRING === typeof pathItem) {
					pathItem = { name: pathItem };
				}
				pathItem.prevSibling = ancestor.prevSibling.slice();
				pathItem.prevSibling.push(ANY_GAP);
			}
			path.push(pathItem);
			if (' ' === ancestor.pathCombinator) {
				path.push(ANY_GAP);
			}
		}
		out.path = path;
	}

	return out;
}

function flattenRuleChain(rule) {
	var list = [];
	var current = rule;
	while (current) {
		if ('Rule' !== current.type) {
			throw new Error('Unsupported selector AST node type: ' + current.type);
		}
		list.push(current);
		current = current.nestedRule;
	}
	return list;
}

function compileCompound(items) {
	if (!(items instanceof Array) || !items.length) {
		throw new Error('Unsupported selector: empty compound selector');
	}
	var out = {
		name: null,
		attrs: [],
	};

	for (var i = 0; i < items.length; i++) {
		var item = items[i];
		switch (item.type) {
			case 'TagName':
				if (null != out.name && '*' !== out.name && out.name !== item.name) {
					throw new Error('Unsupported selector: multiple tag names in one compound selector');
				}
				out.name = item.name;
				break;
			case 'WildcardTag':
				if (null == out.name) out.name = '*';
				break;
			case 'Id':
				out.attrs.push(['id', item.name]);
				break;
			case 'ClassName':
				out.attrs.push(['class', classTokenRegex(item.name)]);
				break;
			case 'Attribute':
				out.attrs.push(attributeToMatcherAttr(item));
				break;
			case 'PseudoClass':
				throw new Error('Unsupported selector rule: pseudo class :' + item.name);
			case 'PseudoElement':
				throw new Error('Unsupported selector rule: pseudo element ::' + item.name);
			default:
				throw new Error('Unsupported selector rule type: ' + item.type);
		}
	}

	if (null == out.name && 0 === out.attrs.length) {
		throw new Error('Unsupported selector: empty compound selector');
	}

	return out;
}

function attributeToMatcherAttr(item) {
	if (!item || 'Attribute' !== item.type) {
		throw new Error('Unsupported selector attribute node');
	}
	if (null == item.operator) {
		return [item.name, null];
	}
	var value = getAttributeLiteralValue(item.value);
	if ('=' === item.operator) {
		return [item.name, value];
	}
	if ('!=' === item.operator) {
		return [item.name, function(attrValue) {
			return String(attrValue) !== value;
		}];
	}
	if ('~=' === item.operator) {
		var tokenRe = classTokenRegex(value);
		return [item.name, function(attrValue) {
			return tokenRe.test(String(attrValue));
		}];
	}
	if ('|=' === item.operator) {
		var langPrefix = value + '-';
		return [item.name, function(attrValue) {
			attrValue = String(attrValue);
			return attrValue === value || 0 === attrValue.indexOf(langPrefix);
		}];
	}
	if ('^=' === item.operator) {
		return [item.name, function(attrValue) {
			return String(attrValue).startsWith(value);
		}];
	}
	if ('$=' === item.operator) {
		return [item.name, function(attrValue) {
			return String(attrValue).endsWith(value);
		}];
	}
	if ('*=' === item.operator) {
		return [item.name, function(attrValue) {
			return String(attrValue).indexOf(value) !== -1;
		}];
	}
	throw new Error('Unsupported selector attribute operator: ' + item.operator);
}

function getAttributeLiteralValue(value) {
	if (null == value) return '';
	if (STRING === typeof value) return value;
	if (STRING === typeof value.value) return value.value;
	throw new Error('Unsupported selector attribute value');
}

function classTokenRegex(cls) {
	return new RegExp('(?:^|\\s)' + escapeRegex(cls) + '(?:\\s|$)');
}

function escapeRegex(str) {
	return String(str).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

function asMatcherInput(compound) {
	var obj = {};
	if (null != compound.name) obj.name = compound.name;
	if (compound.attrs.length) obj.attrs = compound.attrs;
	if (null == obj.name && !obj.attrs) {
		return '*';
	}
	return obj;
}

function asSiblingExact(compound) {
	var base = asMatcherInput(compound);
	if (STRING === typeof base) {
		return base + ' <1>';
	}
	base = Object.assign({}, base);
	base.opt = {
		repeatMin: 1,
		repeatMax: 1,
	};
	return base;
}
