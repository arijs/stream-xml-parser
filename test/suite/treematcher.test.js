'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getParser, TreeMatcher, treeWalk, getMatcherFromCssSelector, getFullTreePath } = require('../..');
const { get } = require('node:http');
function nodeAndPath(root, targetName, elAdapter) {
	const { node: nodeEntry, path: ancestorPath } = getFullTreePath(root, ({ node: n }) => elAdapter.nameGet(n) === targetName, elAdapter);
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



describe('TreeMatcher', () => {
	describe('name matching', () => {
		it('matches by exact name', () => {
			const { tree, elAdapter } = parse('<html></html>');
			const tm = new TreeMatcher(elAdapter);
			tm.name('html');
			const result = tm.testNodeName(tree[0]);
			assert.equal(result.success, true);
		});

		it('fails when name does not match', () => {
			const { tree, elAdapter } = parse('<div></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.name('span');
			const result = tm.testNodeName(tree[0]);
			assert.equal(result.success, false);
		});

		it('matches case-insensitively by default', () => {
			const { tree, elAdapter } = parse('<DIV></DIV>');
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			const result = tm.testNodeName(tree[0]);
			assert.equal(result.success, true);
		});

		it('matches with wildcard *', () => {
			const { tree, elAdapter } = parse('<anything></anything>');
			const tm = new TreeMatcher(elAdapter);
			tm.name('*');
			const result = tm.testNodeName(tree[0]);
			assert.equal(result.success, true);
		});

		it('matches with regex', () => {
			const { tree, elAdapter } = parse('<section></section>');
			const tm = new TreeMatcher(elAdapter);
			tm.name(/^sec/);
			const result = tm.testNodeName(tree[0]);
			assert.equal(result.success, true);
		});

		it('matches with regex against heading tags h1-h6', () => {
			const tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
			for (const tag of tags) {
				const { tree, elAdapter } = parse(`<${tag}></${tag}>`);
				const tm = new TreeMatcher(elAdapter);
				tm.name(/^h[1-6]$/i);
				assert.equal(tm.testNodeName(tree[0]).success, true, `${tag} should match /^h[1-6]$/i`);
			}
			const { tree, elAdapter } = parse('<p></p>');
			const tm = new TreeMatcher(elAdapter);
			tm.name(/^h[1-6]$/i);
			assert.equal(tm.testNodeName(tree[0]).success, false);
		});

		it('matches with function predicate', () => {
			const { tree, elAdapter } = parse('<ol></ol>');
			const tm = new TreeMatcher(elAdapter);
			tm.name(name => name === 'ol' || name === 'ul');
			assert.equal(tm.testNodeName(tree[0]).success, true);
		});

		it('function predicate fails when condition is not met', () => {
			const { tree, elAdapter } = parse('<div></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.name(name => name === 'ol' || name === 'ul');
			assert.equal(tm.testNodeName(tree[0]).success, false);
		});
	});

	describe('attribute matching', () => {
		it('matches by attribute name and value (array form)', () => {
			const { tree, elAdapter } = parse('<div class="foo"></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr(['class', 'foo']);
			const result = tm.testNodeAttrs(tree[0]);
			assert.equal(result.success, true);
		});

		it('fails when attribute value does not match (array form)', () => {
			const { tree, elAdapter } = parse('<div class="bar"></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr(['class', 'foo']);
			const result = tm.testNodeAttrs(tree[0]);
			assert.equal(result.success, false);
		});

		it('matches when attribute name is null/any with null value', () => {
			const { tree, elAdapter } = parse('<div id="main"></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr([null, null]);
			const result = tm.testNodeAttrs(tree[0]);
			assert.equal(result.success, true);
		});

		it('matches attribute with regex value', () => {
			const { tree, elAdapter } = parse('<div class="container main"></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr(['class', /\bcontainer\b/]);
			const result = tm.testNodeAttrs(tree[0]);
			assert.equal(result.success, true);
		});

		it('matches multiple required attributes', () => {
			const { tree, elAdapter } = parse('<a href="/path" rel="noopener"></a>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr(['href', '/path']);
			tm.attr(['rel', 'noopener']);
			const result = tm.testNodeAttrs(tree[0]);
			assert.equal(result.success, true);
		});

		it('matches attribute by string "name=value" form', () => {
			const { tree, elAdapter } = parse('<input maxlength="10">');
			const tm = new TreeMatcher(elAdapter);
			tm.attr('maxlength=10');
			assert.equal(tm.testNodeAttrs(tree[0]).success, true);
		});

		it('fails attribute "name=value" string when value differs', () => {
			const { tree, elAdapter } = parse('<input maxlength="20">');
			const tm = new TreeMatcher(elAdapter);
			tm.attr('maxlength=10');
			assert.equal(tm.testNodeAttrs(tree[0]).success, false);
		});

		it('matches attribute by array with regex name', () => {
			const { tree, elAdapter } = parse('<input disabled>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr([/^disabled$/]);
			assert.equal(tm.testNodeAttrs(tree[0]).success, true);
		});

		it('matches attribute by array with function name', () => {
			const { tree, elAdapter } = parse('<input disabled>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr([name => name === 'disabled']);
			assert.equal(tm.testNodeAttrs(tree[0]).success, true);
		});

		it('matches attribute by array with function value predicate', () => {
			const { tree, elAdapter } = parse('<input maxlength="15">');
			const tm = new TreeMatcher(elAdapter);
			tm.attr([/^maxlength$/, v => +v >= 10 && +v <= 20]);
			assert.equal(tm.testNodeAttrs(tree[0]).success, true);
		});

		it('fails attribute function value predicate when out of range', () => {
			const { tree, elAdapter } = parse('<input maxlength="25">');
			const tm = new TreeMatcher(elAdapter);
			tm.attr([/^maxlength$/, v => +v >= 10 && +v <= 20]);
			assert.equal(tm.testNodeAttrs(tree[0]).success, false);
		});

		it('matches attribute by object form {name, value}', () => {
			const { tree, elAdapter } = parse('<div class="foo"></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr({ name: 'class', value: 'foo' });
			assert.equal(tm.testNodeAttrs(tree[0]).success, true);
		});

		it('matches attribute by object form with regex name', () => {
			const { tree, elAdapter } = parse('<input disabled>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr({ name: /^disabled$/ });
			assert.equal(tm.testNodeAttrs(tree[0]).success, true);
		});

		it('matches attribute by object form with null name (any attr with given value)', () => {
			const { tree, elAdapter } = parse('<div class="foo"></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr({ value: 'foo' });
			assert.equal(tm.testNodeAttrs(tree[0]).success, true);
		});
	});

	describe('attribute repeaters', () => {
		it('[null, null, "<0>"] succeeds on node with no attributes', () => {
			const { tree, elAdapter } = parse('<div></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr([null, null, '<0>']);
			assert.equal(tm.testNodeAttrs(tree[0]).success, true);
		});

		it('[null, null, "<0>"] fails on node with any attribute', () => {
			const { tree, elAdapter } = parse('<div class="foo"></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr([null, null, '<0>']);
			assert.equal(tm.testNodeAttrs(tree[0]).success, false);
		});

		it('<0> repeater negates a specific attribute (node lacks it)', () => {
			const { tree, elAdapter } = parse('<div></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr(['class', 'foo', '<0>']);
			assert.equal(tm.testNodeAttrs(tree[0]).success, true);
		});

		it('<0> repeater negates a specific attribute (node has it)', () => {
			const { tree, elAdapter } = parse('<div class="foo"></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr(['class', 'foo', '<0>']);
			assert.equal(tm.testNodeAttrs(tree[0]).success, false);
		});

		it('[null, null, "<+>"] fails on node with no attributes', () => {
			const { tree, elAdapter } = parse('<div></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr([null, null, '<+>']);
			assert.equal(tm.testNodeAttrs(tree[0]).success, false);
		});

		it('[null, null, "<+>"] succeeds on node with one or more attributes', () => {
			const { tree, elAdapter } = parse('<div id="x"></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr([null, null, '<+>']);
			assert.equal(tm.testNodeAttrs(tree[0]).success, true);
		});

		it('exclusive match: specific attr + [null,null,"<0>"] matches node with ONLY that attr', () => {
			const { tree, elAdapter } = parse('<html><body><div id="root"></div></body></html>');
			const { node } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.attr(['id', 'root']);
			tm.attr([null, null, '<0>']);
			assert.equal(tm.testNodeAttrs(node).success, true);
		});

		it('exclusive match fails when node has additional attributes', () => {
			const { tree, elAdapter } = parse('<html><body><div id="root" class="extra"></div></body></html>');
			const { node } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.attr(['id', 'root']);
			tm.attr([null, null, '<0>']);
			assert.equal(tm.testNodeAttrs(node).success, false);
		});
	});

	describe('path matching', () => {
		it('matches node at correct path', () => {
			const { tree, elAdapter } = parse('<html><body><div id="root"></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'body']);
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('fails when path does not match', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'head']); // wrong path
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, false);
		});

		it('matches with empty path for root-level nodes', () => {
			const { tree, elAdapter } = parse('<html></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'html', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('html');
			tm.path([]);
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('matches path entry with [name, attrs] array form', () => {
			const { tree, elAdapter } = parse('<html lang="en"><body class="main"><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				['html', [['lang', 'en']]],
				['body', [['class', /\bmain\b/]]],
			]);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('fails path entry [name, attrs] when ancestor attr does not match', () => {
			const { tree, elAdapter } = parse('<html lang="fr"><body class="main"><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				['html', [['lang', 'en']]],
				['body', [['class', /\bmain\b/]]],
			]);
			assert.equal(tm.testAll(nodeEntry, path).success, false);
		});

		it('matches path entry with {name, attrs} object form', () => {
			const { tree, elAdapter } = parse('<html lang="en"><body><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				{ name: 'html', attrs: [['lang', 'en']] },
				{ name: 'body' },
			]);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('matches path entry with array[function, attrs] for function name predicate', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				[name => name === 'html' || name === 'head'],
				'body',
			]);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('matches path entry with array[regex] for regex name predicate', () => {
			const { tree, elAdapter } = parse('<html><body><h2><span></span></h2></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'span', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('span');
			tm.path(['html', 'body', [/^h[1-6]$/i]]);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('matches path entry object with previous sibling rule', () => {
			const { tree, elAdapter } = parse('<html><head></head><body><main><div></div></main></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				'html',
				{ name: 'body', prevSibling: ['head <1>'] },
				'main',
			]);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('fails path entry previous sibling rule when adjacent sibling does not match', () => {
			const { tree, elAdapter } = parse('<html><head></head><aside></aside><body><main><div></div></main></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				'html',
				{ name: 'body', prevSibling: ['head <1>'] },
				'main',
			]);
			assert.equal(tm.testAll(nodeEntry, path).success, false);
		});

		it('matches path entry object with next sibling rule', () => {
			const { tree, elAdapter } = parse('<html><body><main><div></div></main></body><aside></aside></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				'html',
				{ name: 'body', sibling: ['aside <1>'] },
				'main',
			]);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('fails path entry next sibling rule when adjacent sibling does not match', () => {
			const { tree, elAdapter } = parse('<html><body><main><div></div></main></body><section></section><aside></aside></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				'html',
				{ name: 'body', sibling: ['aside <1>'] },
				'main',
			]);
			assert.equal(tm.testAll(nodeEntry, path).success, false);
		});

		it('matches path entry previous sibling with explicit wildcard gap', () => {
			const { tree, elAdapter } = parse('<html><head></head><section></section><body><main><div></div></main></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				'html',
				{ name: 'body', prevSibling: ['* <*>', 'head <1>'] },
				'main',
			]);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('matches path entry next sibling with explicit wildcard gap', () => {
			const { tree, elAdapter } = parse('<html><body><main><div></div></main></body><section></section><aside></aside></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				'html',
				{ name: 'body', sibling: ['* <*>', 'aside <1>'] },
				'main',
			]);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});
	});

	describe('path repeaters', () => {
		it('"* <*>" matches any number of intermediate ancestors (zero)', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'body', '* <*>']);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('"* <*>" matches any number of intermediate ancestors (multiple)', () => {
			const { tree, elAdapter } = parse('<html><body><section><article><div></div></article></section></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'body', '* <*>']);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('"* <+>" requires at least one intermediate ancestor', () => {
			const { tree, elAdapter } = parse('<html><body><section><div></div></section></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'body', '* <+>']);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('"* <+>" fails when there are no intermediate ancestors', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'body', '* <+>']);
			assert.equal(tm.testAll(nodeEntry, path).success, false);
		});

		it('"div <+>" matches one or more div ancestors', () => {
			const { tree, elAdapter } = parse('<html><body><div><div><span></span></div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'span', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('span');
			tm.path(['html', 'body', 'div <+>']);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('"div <+>" fails when no div ancestor exists', () => {
			const { tree, elAdapter } = parse('<html><body><section><span></span></section></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'span', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('span');
			tm.path(['html', 'body', 'div <+>']);
			assert.equal(tm.testAll(nodeEntry, path).success, false);
		});

		it('"html <1>" explicitly matches exactly one html ancestor', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html <1>', 'body']);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('"* <2,4>" matches when there are 2-4 intermediate ancestors', () => {
			const { tree, elAdapter } = parse('<html><body><section><article><div></div></article></section></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			// path: [html, body, section, article] — 2 wildcards = section + article
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'body', '* <2,4>']);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('expanded repeater nameOpt {repeatMin, repeatMax} with one or more wildcards', () => {
			const { tree, elAdapter } = parse('<html><body><section><div></div></section></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				{ name: 'html', nameOpt: { repeatMin: 1, repeatMax: 1 } },
				{ name: 'body', nameOpt: { repeatMin: 1, repeatMax: 1 } },
				{ name: '*', nameOpt: { repeatMin: 1, repeatMax: Infinity } },
			]);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('expanded repeater nameOpt fails when intermediates required but absent', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				{ name: 'html', nameOpt: { repeatMin: 1, repeatMax: 1 } },
				{ name: 'body', nameOpt: { repeatMin: 1, repeatMax: 1 } },
				{ name: '*', nameOpt: { repeatMin: 1, repeatMax: Infinity } },
			]);
			assert.equal(tm.testAll(nodeEntry, path).success, false);
		});
	});

	describe('combined matching (testAll)', () => {
		it('matches when name, attr, and path all match', () => {
			const { tree, elAdapter } = parse('<html lang="en"><body><div id="root"></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = TreeMatcher.from(['div', [['id', 'root', '<1>']], ['html', 'body']], elAdapter);
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('fails when name matches but attr does not', () => {
			const { tree, elAdapter } = parse('<html><body><div id="other"></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = TreeMatcher.from(['div', [['id', 'root']], ['html', 'body']], elAdapter);
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, false);
		});

		it('doc example: matches div#root with no other attrs, direct child of body', () => {
			const { tree, elAdapter } = parse('<html><body><div id="root"></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.attr(['id', 'root']);
			tm.attr([null, null, '<0>']);
			tm.path(['html', 'body']);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('doc example: fails when div#root has extra attributes', () => {
			const { tree, elAdapter } = parse('<html><body><div id="root" class="app"></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.attr(['id', 'root']);
			tm.attr([null, null, '<0>']);
			tm.path(['html', 'body']);
			assert.equal(tm.testAll(nodeEntry, path).success, false);
		});

		it('doc example: matches title with no attributes inside html>head', () => {
			const { tree, elAdapter } = parse('<html><head><title>My Page</title></head><body></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'title', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('title');
			tm.attr([null, null, '<0>']);
			tm.path(['html', 'head']);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});

		it('doc example: matches meta with name and content attrs and no others', () => {
			const { tree, elAdapter } = parse('<html><head><meta name="description" content="desc"></head></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'meta', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('meta');
			tm.attr(['name', 'description']);
			tm.attr(['content', null]);
			tm.attr([null, null, '<0>']);
			tm.path(['html', 'head']);
			assert.equal(tm.testAll(nodeEntry, path).success, true);
		});
	});

	describe('TreeMatcher.from factory', () => {
		it('creates from string (name only)', () => {
			const { tree, elAdapter } = parse('<p></p>');
			const tm = TreeMatcher.from('p', elAdapter);
			const result = tm.testNodeName(tree[0]);
			assert.equal(result.success, true);
		});

		it('creates from array [name, attrs, path]', () => {
			const { tree, elAdapter } = parse('<html lang="en"></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'html', elAdapter);
			const tm = TreeMatcher.from(['html', [['lang', 'en']], []], elAdapter);
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('creates from object {name, attrs, path}', () => {
			const { tree, elAdapter } = parse('<html lang="en"></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'html', elAdapter);
			const tm = TreeMatcher.from({
				name: 'html',
				attrs: [['lang', 'en']],
				path: [],
			}, elAdapter);
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('returns same TreeMatcher instance if passed TreeMatcher', () => {
			const { elAdapter } = parse('<div></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			const tm2 = TreeMatcher.from(tm, elAdapter);
			assert.equal(tm2, tm);
		});
	});

	describe('TreeMatcher.fromArray (testNodeSub)', () => {
		it('matches if any sub-matcher succeeds', () => {
			const { tree, elAdapter } = parse('<html lang="en"><body><div id="root"></div></body></html>');
			const { nodeEntry, path: ancestorPath } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = TreeMatcher.fromArray([
				['div', [['id', 'root', '<1>']], ['html', 'body']],
			], elAdapter);
			const result = tm.testNodeSub(nodeEntry, ancestorPath);
			assert.equal(result.success, true);
		});

		it('fails if no sub-matcher succeeds', () => {
			const { tree, elAdapter } = parse('<html><body><span></span></body></html>');
			const { nodeEntry, path: ancestorPath } = nodeAndPath(tree[0], 'span', elAdapter);
			const tm = TreeMatcher.fromArray([
				['div', [], ['html', 'body']],
			], elAdapter);
			const result = tm.testNodeSub(nodeEntry, ancestorPath);
			assert.equal(result.success, false);
		});

		it('matches first successful sub-matcher', () => {
			const { tree, elAdapter } = parse('<html><head><title></title></head></html>');
			const { nodeEntry, path: ancestorPath } = nodeAndPath(tree[0], 'title', elAdapter);
			const tm = TreeMatcher.fromArray([
				['span', [], ['html', 'body']],     // won't match
				['title', [], ['html', 'head']],    // will match
				['p', [], ['html', 'body']],        // won't be reached
			], elAdapter);
			const result = tm.testNodeSub(nodeEntry, ancestorPath);
			assert.equal(result.success, true);
		});
	});

	describe('sibling matching (next siblings)', () => {
		it('matches a next sibling by name', () => {
			const { tree, elAdapter } = parse('<html><body><span></span><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'span', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('span');
			tm.sibling('div');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('fails when next sibling name does not match', () => {
			const { tree, elAdapter } = parse('<html><body><span></span><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'span', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('span');
			tm.sibling('p');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, false);
		});

		it('matches with sibling regex pattern', () => {
			const { tree, elAdapter } = parse('<html><body><section></section><div class="box"></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'section', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('section');
			tm.sibling(['div', [['class', /box/]]]);
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('matches with sibling function predicate', () => {
			const { tree, elAdapter } = parse('<html><body><ol></ol><ul></ul></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'ol', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('ol');
			tm.sibling(name => name === 'ul' || name === 'dl');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('fails multiple next siblings with repeater <+> when trailing siblings are not explicitly allowed', () => {
			const { tree, elAdapter } = parse('<html><body><div></div><span></span><span></span><p></p></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.sibling('span <+>');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, false);
		});

		it('matches multiple next siblings with repeater <+> when caller explicitly allows trailing siblings', () => {
			const { tree, elAdapter } = parse('<html><body><div></div><span></span><span></span><p></p></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.sibling('span <+>');
			tm.sibling('* <*>');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('supports explicit wildcard gap before a required next sibling', () => {
			const { tree, elAdapter } = parse('<html><body><b></b><x></x><y></y><a></a></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'b', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('b');
			tm.sibling('* <*>');
			tm.sibling('a <1>');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('fails non-adjacent required next sibling when wildcard gap is not explicit', () => {
			const { tree, elAdapter } = parse('<html><body><b></b><x></x><y></y><a></a></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'b', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('b');
			tm.sibling('a <1>');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, false);
		});

		it('matches optional next sibling with repeater <?>', () => {
			const { tree, elAdapter } = parse('<html><body><p></p><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'p', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('p');
			tm.sibling('div <?>');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('fails when required next sibling does not exist', () => {
			const { tree, elAdapter } = parse('<html><body><p></p><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'p', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('p');
			tm.sibling('span <+>');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, false);
		});

		it('auto-fails when node is root (no parent)', () => {
			const { tree, elAdapter } = parse('<html></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'html', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('html');
			tm.sibling('div');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, false);
		});
	});

	describe('sibling matching (previous siblings)', () => {
		it('matches a previous sibling by name', () => {
			const { tree, elAdapter } = parse('<html><body><div></div><span></span></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'span', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('span');
			tm.prevSibling('div');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('supports adjacent sibling semantics with explicit <1>', () => {
			const { tree, elAdapter } = parse('<html><body><a></a><b></b><c></c></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'b', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('b');
			tm.prevSibling('a <1>');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('supports chained previous-sibling rules with wildcard repeater then explicit match', () => {
			const { tree, elAdapter } = parse('<html><body><a></a><x></x><y></y><b></b></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'b', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('b');
			tm.prevSibling('* <*>');
			tm.prevSibling('a <1>');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('fails non-adjacent required previous sibling when wildcard gap is not explicit', () => {
			const { tree, elAdapter } = parse('<html><body><a></a><x></x><y></y><b></b></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'b', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('b');
			tm.prevSibling('a <1>');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, false);
		});

		it('fails when previous sibling name does not match', () => {
			const { tree, elAdapter } = parse('<html><body><div></div><span></span></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'span', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('span');
			tm.prevSibling('p');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, false);
		});

		it('fails multiple previous siblings with repeater <+> when trailing siblings are not explicitly allowed', () => {
			const { tree, elAdapter } = parse('<html><body><div></div><span></span><span></span><p></p></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'p', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('p');
			tm.prevSibling('span <+>');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, false);
		});

		it('matches multiple previous siblings with repeater <+> when caller explicitly allows trailing siblings', () => {
			const { tree, elAdapter } = parse('<html><body><div></div><span></span><span></span><p></p></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'p', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('p');
			tm.prevSibling('span <+>');
			tm.prevSibling('* <*>');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('matches previous siblings in reverse order', () => {
			const { tree, elAdapter } = parse('<html><body><a></a><b></b><c></c><d></d></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'd', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('d');
			tm.prevSibling('c');
			tm.prevSibling('b');
			tm.prevSibling('a');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('auto-fails when node is root (no parent)', () => {
			const { tree, elAdapter } = parse('<html></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'html', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('html');
			tm.prevSibling('div');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, false);
		});
	});

	describe('combined matching with siblings', () => {
		it('matches name, path, and next sibling all together', () => {
			const { tree, elAdapter } = parse('<html><body><h1></h1><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'h1', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('h1');
			tm.path(['html', 'body']);
			tm.sibling('div');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('matches div with id and next span sibling', () => {
			const { tree, elAdapter } = parse('<html><body><div id="main"></div><span></span></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.attr(['id', 'main']);
			tm.sibling('span');
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('fails when sibling rule fails even if all other rules pass', () => {
			const { tree, elAdapter } = parse('<html><body><a></a><div id="main"></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'a', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('a');
			tm.sibling('span'); // will fail because next is <div>, not <span>
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, false);
		});
	});

	describe('factory methods with siblings', () => {
		it('creates from array [name, attrs, path, siblings]', () => {
			const { tree, elAdapter } = parse('<html><body><h1></h1><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'h1', elAdapter);
			const tm = TreeMatcher.from(['h1', [], ['html', 'body'], ['div']], elAdapter);
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('creates from array [name, attrs, path, siblings, prevSiblings]', () => {
			const { tree, elAdapter } = parse('<html><body><span></span><div></div><p></p></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = TreeMatcher.from(['div', [], ['html', 'body'], ['p'], ['span']], elAdapter);
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});

		it('creates from object {name, attrs, path, sibling, prevSibling}', () => {
			const { tree, elAdapter } = parse('<html><body><h1></h1><div></div></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'h1', elAdapter);
			const tm = TreeMatcher.from({
				name: 'h1',
				path: ['html', 'body'],
				sibling: ['div'],
			}, elAdapter);
			const result = tm.testAll(nodeEntry, path);
			assert.equal(result.success, true);
		});
	});

	describe('sub-rules with siblings', () => {
		it('matches sub-rule with next sibling', () => {
			const { tree, elAdapter } = parse('<html><body><h1></h1><div></div></body></html>');
			const { nodeEntry, path: ancestorPath } = nodeAndPath(tree[0], 'h1', elAdapter);
			const tm = TreeMatcher.fromArray([
				['h1', [], ['html', 'body'], ['div']]
			], elAdapter);
			const result = tm.testNodeSub(nodeEntry, ancestorPath);
			assert.equal(result.success, true);
		});

		it('fails sub-rule when next sibling does not match', () => {
			const { tree, elAdapter } = parse('<html><body><h1></h1><span></span></body></html>');
			const { nodeEntry, path: ancestorPath } = nodeAndPath(tree[0], 'h1', elAdapter);
			const tm = TreeMatcher.fromArray([
				['h1', [], ['html', 'body'], ['div']]
			], elAdapter);
			const result = tm.testNodeSub(nodeEntry, ancestorPath);
			assert.equal(result.success, false);
		});

		it('matches sub-rule with prev sibling', () => {
			const { tree, elAdapter } = parse('<html><body><span></span><div></div></body></html>');
			const { nodeEntry, path: ancestorPath } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = TreeMatcher.fromArray([
				['div', [], ['html', 'body'], [], ['span']]
			], elAdapter);
			const result = tm.testNodeSub(nodeEntry, ancestorPath);
			assert.equal(result.success, true);
		});

		it('fails sub-rule when prev sibling does not match', () => {
			const { tree, elAdapter } = parse('<html><body><p></p><div></div></body></html>');
			const { nodeEntry, path: ancestorPath } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = TreeMatcher.fromArray([
				['div', [], ['html', 'body'], [], ['span']]
			], elAdapter);
			const result = tm.testNodeSub(nodeEntry, ancestorPath);
			assert.equal(result.success, false);
		});

		it('matches sub-rule with both next and prev siblings', () => {
			const { tree, elAdapter } = parse('<html><body><span></span><div id="main"></div><p></p></body></html>');
			const { nodeEntry, path: ancestorPath } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = TreeMatcher.fromArray([
				['div', [['id', 'main']], ['html', 'body'], ['p'], ['span']]
			], elAdapter);
			const result = tm.testNodeSub(nodeEntry, ancestorPath);
			assert.equal(result.success, true);
		});

		it('creates sub-rule from object with sibling and prevSibling', () => {
			const { tree, elAdapter } = parse('<html><body><a></a><div></div><span></span></body></html>');
			const { nodeEntry, path: ancestorPath } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = TreeMatcher.fromArray([
				{
					name: 'div',
					path: ['html', 'body'],
					sibling: ['span'],
					prevSibling: ['a']
				}
			], elAdapter);
			const result = tm.testNodeSub(nodeEntry, ancestorPath);
			assert.equal(result.success, true);
		});

		it('uses sibling context from path without explicit childIndex', () => {
			const { tree, elAdapter } = parse('<html><body><h1></h1><div></div></body></html>');
			const { nodeEntry, path: ancestorPath } = nodeAndPath(tree[0], 'h1', elAdapter);
			const tm = TreeMatcher.fromArray([
				['h1', [], ['html', 'body'], ['div']]
			], elAdapter);
			const result = tm.testNodeSub(nodeEntry, ancestorPath);
			assert.equal(result.success, true);
		});

		it('fails when name/attrs/path fail even if siblings would match', () => {
			const { tree, elAdapter } = parse('<html><body><h1></h1><div></div></body></html>');
			const { nodeEntry, path: ancestorPath } = nodeAndPath(tree[0], 'h1', elAdapter);
			const tm = TreeMatcher.fromArray([
				['span', [], ['html', 'body'], ['div']]  // h1 doesn't match span
			], elAdapter);
			const result = tm.testNodeSub(nodeEntry, ancestorPath);
			assert.equal(result.success, false);
		});

		it('supports method override as third argument', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const { nodeEntry, path: ancestorPath } = nodeAndPath(tree[0], 'div', elAdapter);
			const tm = TreeMatcher.fromArray([
				['div', [], ['html', 'body']]
			], elAdapter);
			const result = tm.testNodeSub(nodeEntry, ancestorPath, TreeMatcher.method.orList);
			assert.equal(result.success, true);
		});
	});

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

		it('supports multiple selectors (a, b) as OR', () => {
			const { tree, elAdapter } = parse('<html><body><span></span></body></html>');
			const { nodeEntry, path } = nodeAndPath(tree[0], 'span', elAdapter);
			const tm = getMatcherFromCssSelector('div, span', elAdapter);
			const result = tm.testNodeSub(nodeEntry, path);
			assert.equal(result.success, true);
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
});

