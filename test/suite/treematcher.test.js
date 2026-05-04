'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getParser, TreeMatcher, treeWalk } = require('../..');

function parse(html) {
	const p = getParser();
	p.end(html);
	return p.getResult();
}

function getNodeAndPath(root, targetName, elAdapter) {
	let targetNode = null, targetPath = null;
	treeWalk(root, elAdapter, {
		onNode: function(node, path) {
			if (elAdapter.nameGet(node) === targetName && !targetNode) {
				targetNode = node;
				targetPath = path.slice();
			}
		},
	}, []);
	return { node: targetNode, path: targetPath };
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
			const { node } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.attr(['id', 'root']);
			tm.attr([null, null, '<0>']);
			assert.equal(tm.testNodeAttrs(node).success, true);
		});

		it('exclusive match fails when node has additional attributes', () => {
			const { tree, elAdapter } = parse('<html><body><div id="root" class="extra"></div></body></html>');
			const { node } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.attr(['id', 'root']);
			tm.attr([null, null, '<0>']);
			assert.equal(tm.testNodeAttrs(node).success, false);
		});
	});

	describe('path matching', () => {
		it('matches node at correct path', () => {
			const { tree, elAdapter } = parse('<html><body><div id="root"></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'body']);
			const result = tm.testAll(node, path);
			assert.equal(result.success, true);
		});

		it('fails when path does not match', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'head']); // wrong path
			const result = tm.testAll(node, path);
			assert.equal(result.success, false);
		});

		it('matches with empty path for root-level nodes', () => {
			const { tree, elAdapter } = parse('<html></html>');
			const tm = new TreeMatcher(elAdapter);
			tm.name('html');
			tm.path([]);
			const result = tm.testAll(tree[0], []);
			assert.equal(result.success, true);
		});

		it('matches path entry with [name, attrs] array form', () => {
			const { tree, elAdapter } = parse('<html lang="en"><body class="main"><div></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				['html', [['lang', 'en']]],
				['body', [['class', /\bmain\b/]]],
			]);
			assert.equal(tm.testAll(node, path).success, true);
		});

		it('fails path entry [name, attrs] when ancestor attr does not match', () => {
			const { tree, elAdapter } = parse('<html lang="fr"><body class="main"><div></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				['html', [['lang', 'en']]],
				['body', [['class', /\bmain\b/]]],
			]);
			assert.equal(tm.testAll(node, path).success, false);
		});

		it('matches path entry with {name, attrs} object form', () => {
			const { tree, elAdapter } = parse('<html lang="en"><body><div></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				{ name: 'html', attrs: [['lang', 'en']] },
				{ name: 'body' },
			]);
			assert.equal(tm.testAll(node, path).success, true);
		});

		it('matches path entry with array[function, attrs] for function name predicate', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				[name => name === 'html' || name === 'head'],
				'body',
			]);
			assert.equal(tm.testAll(node, path).success, true);
		});

		it('matches path entry with array[regex] for regex name predicate', () => {
			const { tree, elAdapter } = parse('<html><body><h2><span></span></h2></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'span', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('span');
			tm.path(['html', 'body', [/^h[1-6]$/i]]);
			assert.equal(tm.testAll(node, path).success, true);
		});
	});

	describe('path repeaters', () => {
		it('"* <*>" matches any number of intermediate ancestors (zero)', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'body', '* <*>']);
			assert.equal(tm.testAll(node, path).success, true);
		});

		it('"* <*>" matches any number of intermediate ancestors (multiple)', () => {
			const { tree, elAdapter } = parse('<html><body><section><article><div></div></article></section></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'body', '* <*>']);
			assert.equal(tm.testAll(node, path).success, true);
		});

		it('"* <+>" requires at least one intermediate ancestor', () => {
			const { tree, elAdapter } = parse('<html><body><section><div></div></section></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'body', '* <+>']);
			assert.equal(tm.testAll(node, path).success, true);
		});

		it('"* <+>" fails when there are no intermediate ancestors', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'body', '* <+>']);
			assert.equal(tm.testAll(node, path).success, false);
		});

		it('"div <+>" matches one or more div ancestors', () => {
			const { tree, elAdapter } = parse('<html><body><div><div><span></span></div></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'span', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('span');
			tm.path(['html', 'body', 'div <+>']);
			assert.equal(tm.testAll(node, path).success, true);
		});

		it('"div <+>" fails when no div ancestor exists', () => {
			const { tree, elAdapter } = parse('<html><body><section><span></span></section></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'span', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('span');
			tm.path(['html', 'body', 'div <+>']);
			assert.equal(tm.testAll(node, path).success, false);
		});

		it('"html <1>" explicitly matches exactly one html ancestor', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html <1>', 'body']);
			assert.equal(tm.testAll(node, path).success, true);
		});

		it('"* <2,4>" matches when there are 2-4 intermediate ancestors', () => {
			const { tree, elAdapter } = parse('<html><body><section><article><div></div></article></section></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			// path: [html, body, section, article] — 2 wildcards = section + article
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path(['html', 'body', '* <2,4>']);
			assert.equal(tm.testAll(node, path).success, true);
		});

		it('expanded repeater nameOpt {repeatMin, repeatMax} with one or more wildcards', () => {
			const { tree, elAdapter } = parse('<html><body><section><div></div></section></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				{ name: 'html', nameOpt: { repeatMin: 1, repeatMax: 1 } },
				{ name: 'body', nameOpt: { repeatMin: 1, repeatMax: 1 } },
				{ name: '*', nameOpt: { repeatMin: 1, repeatMax: Infinity } },
			]);
			assert.equal(tm.testAll(node, path).success, true);
		});

		it('expanded repeater nameOpt fails when intermediates required but absent', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.path([
				{ name: 'html', nameOpt: { repeatMin: 1, repeatMax: 1 } },
				{ name: 'body', nameOpt: { repeatMin: 1, repeatMax: 1 } },
				{ name: '*', nameOpt: { repeatMin: 1, repeatMax: Infinity } },
			]);
			assert.equal(tm.testAll(node, path).success, false);
		});
	});

	describe('combined matching (testAll)', () => {
		it('matches when name, attr, and path all match', () => {
			const { tree, elAdapter } = parse('<html lang="en"><body><div id="root"></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = TreeMatcher.from(['div', [['id', 'root', '<1>']], ['html', 'body']], elAdapter);
			const result = tm.testAll(node, path);
			assert.equal(result.success, true);
		});

		it('fails when name matches but attr does not', () => {
			const { tree, elAdapter } = parse('<html><body><div id="other"></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = TreeMatcher.from(['div', [['id', 'root']], ['html', 'body']], elAdapter);
			const result = tm.testAll(node, path);
			assert.equal(result.success, false);
		});

		it('doc example: matches div#root with no other attrs, direct child of body', () => {
			const { tree, elAdapter } = parse('<html><body><div id="root"></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.attr(['id', 'root']);
			tm.attr([null, null, '<0>']);
			tm.path(['html', 'body']);
			assert.equal(tm.testAll(node, path).success, true);
		});

		it('doc example: fails when div#root has extra attributes', () => {
			const { tree, elAdapter } = parse('<html><body><div id="root" class="app"></div></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('div');
			tm.attr(['id', 'root']);
			tm.attr([null, null, '<0>']);
			tm.path(['html', 'body']);
			assert.equal(tm.testAll(node, path).success, false);
		});

		it('doc example: matches title with no attributes inside html>head', () => {
			const { tree, elAdapter } = parse('<html><head><title>My Page</title></head><body></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'title', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('title');
			tm.attr([null, null, '<0>']);
			tm.path(['html', 'head']);
			assert.equal(tm.testAll(node, path).success, true);
		});

		it('doc example: matches meta with name and content attrs and no others', () => {
			const { tree, elAdapter } = parse('<html><head><meta name="description" content="desc"></head></html>');
			const { node, path } = getNodeAndPath(tree[0], 'meta', elAdapter);
			const tm = new TreeMatcher(elAdapter);
			tm.name('meta');
			tm.attr(['name', 'description']);
			tm.attr(['content', null]);
			tm.attr([null, null, '<0>']);
			tm.path(['html', 'head']);
			assert.equal(tm.testAll(node, path).success, true);
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
			const tm = TreeMatcher.from(['html', [['lang', 'en']], []], elAdapter);
			const result = tm.testAll(tree[0], []);
			assert.equal(result.success, true);
		});

		it('creates from object {name, attrs, path}', () => {
			const { tree, elAdapter } = parse('<html lang="en"></html>');
			const tm = TreeMatcher.from({
				name: 'html',
				attrs: [['lang', 'en']],
				path: [],
			}, elAdapter);
			const result = tm.testAll(tree[0], []);
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
			const { node, path } = getNodeAndPath(tree[0], 'div', elAdapter);
			const tm = TreeMatcher.fromArray([
				['div', [['id', 'root', '<1>']], ['html', 'body']],
			], elAdapter);
			const result = tm.testNodeSub(node, path);
			assert.equal(result.success, true);
		});

		it('fails if no sub-matcher succeeds', () => {
			const { tree, elAdapter } = parse('<html><body><span></span></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'span', elAdapter);
			const tm = TreeMatcher.fromArray([
				['div', [], ['html', 'body']],
			], elAdapter);
			const result = tm.testNodeSub(node, path);
			assert.equal(result.success, false);
		});

		it('matches first successful sub-matcher', () => {
			const { tree, elAdapter } = parse('<html><head><title></title></head></html>');
			const { node, path } = getNodeAndPath(tree[0], 'title', elAdapter);
			const tm = TreeMatcher.fromArray([
				['span', [], ['html', 'body']],     // won't match
				['title', [], ['html', 'head']],    // will match
				['p', [], ['html', 'body']],        // won't be reached
			], elAdapter);
			const result = tm.testNodeSub(node, path);
			assert.equal(result.success, true);
		});
	});
});
