import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getParser, getMatcherFromCssSelector, getFullTreePath } from '../../src/index.mjs';

function nodeAndPath(root, targetName, elAdapter) {
	const fullTreePath = getFullTreePath(root, ({ node: n }) => elAdapter.nameGet(n.node) === targetName, elAdapter);
	if (!fullTreePath) {
		return { node: null, path: null, fullPath: null };
	}
	const { node: nodeEntry, path: ancestorPath } = fullTreePath;
	if (!nodeEntry) {
		return { node: null, path: null, fullPath: null };
	}
	const node = nodeEntry.node;
	const fullPath = [...ancestorPath, nodeEntry];
	return { node, nodeEntry, path: ancestorPath, fullPath };
}

function parse(html) {
	const p = getParser();
	p.end(html);
	return p.getResult();
}

function stripPseudoItems(items) {
	return items.filter(item => item.type !== 'PseudoClass' && item.type !== 'PseudoElement');
}

function stripPseudosFromRule(rule) {
	if (!rule) return rule;
	const nextRule = {
		...rule,
		items: stripPseudoItems(rule.items || []),
	};
	if (rule.nestedRule) {
		nextRule.nestedRule = stripPseudosFromRule(rule.nestedRule);
	}
	return nextRule;
}

function stripPseudosFromSelectorAst(ast) {
	return {
		...ast,
		rules: (ast.rules || []).map(stripPseudosFromRule),
	};
}

function stripPseudosFromRuleItems(context) {
	return stripPseudoItems(context.items);
}

describe('getMatcherFromCssSelector', () => {
	it('supports wildcard selector (*)', () => {
		const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
		const tm = getMatcherFromCssSelector('*', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('supports tag, id, class and attribute equality', () => {
		const { tree, elAdapter } = parse('<html><body><div id="foo" class="container main" rows="2"></div></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
		const tm = getMatcherFromCssSelector('div#foo.container[rows="2"]', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('supports multiple classes and attribute equality', () => {
		const { tree, elAdapter } = parse('<html><body><div id="foo" class="foo main bar container baz quux" rows="2"></div></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
		const tm = getMatcherFromCssSelector('div#foo.container.main[rows="2"]', elAdapter, {
			afterProcessCompiledRule: ({ compiledRule }) => {
				assert.equal('object', typeof compiledRule, 'afterProcessCompiledRule should be called with the compiled rule');
				assert.equal(compiledRule.name, 'div', 'Compiled rule should have the correct tag name');
				assert.ok(compiledRule.attrs instanceof Array, 'Compiled rule should have an attrs array');
				assert.equal(compiledRule.attrs.length, 4, 'Compiled rule should have the correct number of attributes');
				assert.ok(compiledRule.attrs.some(attr => {
					return attr[0] === 'id' &&
						attr[1] === 'foo';
				}), 'Compiled rule should have the correct id attribute');
				assert.ok(compiledRule.attrs.some(attr => {
					return attr[0] === 'class' &&
						attr[1].test('foo main bar container baz quux');
				}), 'Compiled rule should have the correct class attribute for container');
				assert.ok(compiledRule.attrs.some(attr => {
					return attr[0] === 'class' &&
						attr[1].test('foo main bar container baz quux');
				}), 'Compiled rule should have the correct class attribute for main');
				assert.ok(compiledRule.attrs.some(attr => {
					return attr[0] === 'rows' &&
						attr[1] === '2';
				}), 'Compiled rule should have the correct rows attribute');
			},
		});
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('supports multiple selectors (a, b) as OR', () => {
		const { tree, elAdapter } = parse('<html><body><span></span></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'span', elAdapter);
		const tm = getMatcherFromCssSelector('div, span', elAdapter);
		const result = tm.testNodeSub(nodeEntry, path);
		assert.equal(result.success, true);
		const resultAll = tm.testAll(nodeEntry, path);
		assert.equal(resultAll.success, true);
	});

	it('supports descendant combinator (p span)', () => {
		const { tree, elAdapter } = parse('<html><body><p><em><span></span></em></p></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'span', elAdapter);
		const tm = getMatcherFromCssSelector('p span', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('supports direct child combinator (p > span)', () => {
		const { tree, elAdapter } = parse('<html><body><p><span></span></p></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'span', elAdapter);
		const tm = getMatcherFromCssSelector('p > span', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('fails direct child combinator when only descendant exists', () => {
		const { tree, elAdapter } = parse('<html><body><p><em><span></span></em></p></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'span', elAdapter);
		const tm = getMatcherFromCssSelector('p > span', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, false);
	});

	it('supports adjacent sibling combinator (a + b)', () => {
		const { tree, elAdapter } = parse('<html><body><x></x><a></a><b></b></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'b', elAdapter);
		const tm = getMatcherFromCssSelector('a + b', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('supports subsequent sibling combinator (a ~ b)', () => {
		const { tree, elAdapter } = parse('<html><body><x></x><a></a><y></y><b></b></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'b', elAdapter);
		const tm = getMatcherFromCssSelector('a ~ b', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('supports adjacent sibling combinator for head + body', () => {
		const { tree, elAdapter } = parse('<html><head></head><body><main><div></div></main></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'body', elAdapter);
		const tm = getMatcherFromCssSelector('head + body', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('supports ancestor adjacent sibling combinator (head + body main div)', () => {
		const { tree, elAdapter } = parse('<html><head></head><body><main><div></div></main></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
		const tm = getMatcherFromCssSelector('head + body main div', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('fails adjacent sibling combinator for head + body when there is an intermediate sibling', () => {
		const { tree, elAdapter } = parse('<html><head></head><section></section><body><main><div></div></main></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'body', elAdapter);
		const tm = getMatcherFromCssSelector('head + body', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, false);
	});

	it('fails ancestor adjacent sibling combinator (head + body main div) when there is an intermediate sibling', () => {
		const { tree, elAdapter } = parse('<html><head></head><section></section><body><main><div></div></main></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
		const tm = getMatcherFromCssSelector('head + body main div', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, false);
	});

	it('supports subsequent sibling combinator for head ~ body with explicit gap', () => {
		const { tree, elAdapter } = parse('<html><head></head><section></section><body><main><div></div></main></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'body', elAdapter);
		const tm = getMatcherFromCssSelector('head ~ body', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('supports ancestor subsequent sibling combinator (head ~ body main div) with explicit gap', () => {
		const { tree, elAdapter } = parse('<html><head></head><section></section><body><main><div></div></main></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
		const tm = getMatcherFromCssSelector('head ~ body main div', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('supports subsequent sibling combinator for body ~ aside with explicit gap', () => {
		const { tree, elAdapter } = parse('<html><body><main><div></div></main></body><section></section><aside></aside></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'aside', elAdapter);
		const tm = getMatcherFromCssSelector('body ~ aside', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('fails adjacent sibling combinator for body + aside when there is an intermediate sibling', () => {
		const { tree, elAdapter } = parse('<html><body><main><div></div></main></body><section></section><aside></aside></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'aside', elAdapter);
		const tm = getMatcherFromCssSelector('body + aside', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, false);
	});

	it('supports ancestor adjacent sibling combinator (body + aside main div)', () => {
		const { tree, elAdapter } = parse('<html><body></body><aside><main><div></div></main></aside></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
		const tm = getMatcherFromCssSelector('body + aside main div', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('fails ancestor adjacent sibling combinator (body + aside main div) when there is an intermediate sibling', () => {
		const { tree, elAdapter } = parse('<html><body></body><section></section><aside><main><div></div></main></aside></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
		const tm = getMatcherFromCssSelector('body + aside main div', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, false);
	});

	it('supports ancestor subsequent sibling combinator (body ~ aside main div) with explicit gap', () => {
		const { tree, elAdapter } = parse('<html><body></body><section></section><aside><main><div></div></main></aside></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
		const tm = getMatcherFromCssSelector('body ~ aside main div', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('throws on unsupported pseudo classes', () => {
		const { elAdapter } = parse('<div></div>');
		assert.throws(() => getMatcherFromCssSelector('a:hover', elAdapter), /Unsupported selector rule: pseudo class/);
	});

	it('throws on unsupported pseudo elements', () => {
		const { elAdapter } = parse('<div></div>');
		assert.throws(() => getMatcherFromCssSelector('a::before', elAdapter), /Unsupported selector rule: pseudo element/);
	});

	it('beforeProcessAst can strip pseudo classes and pseudo elements and still match', () => {
		const { tree, elAdapter } = parse('<html><body><div class="notice"><a class="link">docs</a></div></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'a', elAdapter);
		const tm = getMatcherFromCssSelector('div.notice:hover::before > a.link:focus', elAdapter, {
			beforeProcessAst: stripPseudosFromSelectorAst,
		});
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('beforeProcessAst can strip pseudo classes and pseudo elements but still not match the wrong node', () => {
		const { tree, elAdapter } = parse('<html><body><div class="other"><a class="link">docs</a></div></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'a', elAdapter);
		const tm = getMatcherFromCssSelector('div.notice:hover::before > a.link:focus', elAdapter, {
			beforeProcessAst: stripPseudosFromSelectorAst,
		});
		assert.equal(tm.testAll(nodeEntry, path).success, false);
	});

	it('beforeProcessAstRule can strip pseudo classes and pseudo elements and still match', () => {
		const { tree, elAdapter } = parse('<html><body><div class="notice"><a class="link">docs</a></div></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'a', elAdapter);
		const tm = getMatcherFromCssSelector('div.notice:hover::before > a.link:focus', elAdapter, {
			beforeProcessAstRule: stripPseudosFromRule,
		});
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('beforeProcessAstRule can strip pseudo classes and pseudo elements but still not match the wrong node', () => {
		const { tree, elAdapter } = parse('<html><body><div class="notice"><a class="other">docs</a></div></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'a', elAdapter);
		const tm = getMatcherFromCssSelector('div.notice:hover::before > a.link:focus', elAdapter, {
			beforeProcessAstRule: stripPseudosFromRule,
		});
		assert.equal(tm.testAll(nodeEntry, path).success, false);
	});

	it('beforeProcessAstRuleItemRecursive can strip pseudo classes and pseudo elements and still match', () => {
		const { tree, elAdapter } = parse('<html><body><div class="notice"><a class="link">docs</a></div></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'a', elAdapter);
		const tm = getMatcherFromCssSelector('div.notice:hover::before > a.link:focus', elAdapter, {
			beforeProcessAstRuleItemRecursive: stripPseudosFromRuleItems,
		});
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('beforeProcessAstRuleItemRecursive can strip pseudo classes and pseudo elements but still not match the wrong node', () => {
		const { tree, elAdapter } = parse('<html><body><div class="other"><a class="link">docs</a></div></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'a', elAdapter);
		const tm = getMatcherFromCssSelector('div.notice:hover::before > a.link:focus', elAdapter, {
			beforeProcessAstRuleItemRecursive: stripPseudosFromRuleItems,
		});
		assert.equal(tm.testAll(nodeEntry, path).success, false);
	});

	it('supports attribute operator ^=', () => {
		const { tree, elAdapter } = parse('<html><body><a href="/docs/start"></a></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'a', elAdapter);
		const tm = getMatcherFromCssSelector('a[href^="/"]', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('supports attribute operator $=', () => {
		const { tree, elAdapter } = parse('<html><body><a href="guide.pdf"></a></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'a', elAdapter);
		const tm = getMatcherFromCssSelector('a[href$=".pdf"]', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('supports attribute operator *=', () => {
		const { tree, elAdapter } = parse('<html><body><a href="/api/v1/list"></a></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'a', elAdapter);
		const tm = getMatcherFromCssSelector('a[href*="api"]', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('supports attribute operator ~=', () => {
		const { tree, elAdapter } = parse('<html><body><a class="btn primary"></a></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'a', elAdapter);
		const tm = getMatcherFromCssSelector('a[class~="btn"]', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});

	it('supports attribute operator |=', () => {
		const { tree, elAdapter } = parse('<html><body><a lang="en-US"></a></body></html>');
		const { nodeEntry, path } = nodeAndPath(tree[0], 'a', elAdapter);
		const tm = getMatcherFromCssSelector('a[lang|="en"]', elAdapter);
		assert.equal(tm.testAll(nodeEntry, path).success, true);
	});
});