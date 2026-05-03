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
	});

	describe('attribute matching', () => {
		it('matches by attribute name and value', () => {
			const { tree, elAdapter } = parse('<div class="foo"></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr(['class', 'foo']);
			const result = tm.testNodeAttrs(tree[0]);
			assert.equal(result.success, true);
		});

		it('fails when attribute value does not match', () => {
			const { tree, elAdapter } = parse('<div class="bar"></div>');
			const tm = new TreeMatcher(elAdapter);
			tm.attr(['class', 'foo']);
			const result = tm.testNodeAttrs(tree[0]);
			assert.equal(result.success, false);
		});

		it('matches when attribute name is null (any attribute)', () => {
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
