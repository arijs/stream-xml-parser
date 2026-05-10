'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getParser, printerTransform, elementDefault, Printer, treeWalk } = require('../..');

function parse(html) {
	const p = getParser();
	p.end(html);
	return p.getResult();
}

function getNodeAndPath(root, targetName, elAdapter) {
	let targetNode = null;
	let targetPath = null;
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

/**
 * Wraps printerTransform.async in a Promise for use in async tests.
 */
function transformAsync(tree, elAdapter, transform) {
	return new Promise((resolve, reject) => {
		printerTransform.async({
			tree, elAdapter, transform,
			callback: function(err, html) {
				if (err && err.length) reject(err);
				else resolve(html);
			},
		});
	});
}

function transformSync(tree, elAdapter, transform) {
	return printerTransform.sync({
		tree, elAdapter, transform,
	});
}

describe('printerTransform', () => {
	describe('printTreeSync', () => {
		it('serializes a tree to a string', () => {
			const el = elementDefault();
			const div = el.initName('div');
			el.childText(div, 'Hello');
			const result = printerTransform.printTreeSync({ tree: [div], elAdapter: el, level: 0 });
			assert.ok(result.includes('Hello'));
			assert.ok(result.includes('<div>'));
		});

		it('serializes an empty element', () => {
			const el = elementDefault();
			const span = el.initName('span');
			const result = printerTransform.printTreeSync({ tree: [span], elAdapter: el, level: 0 });
			assert.ok(result.includes('<span>') || result.includes('<span/>'));
		});
	});

	describe('prepare', () => {
		it('returns text unchanged when noFormat is true', () => {
			const el = elementDefault();
			const printer = new Printer({ elAdapter: el });
			const result = printerTransform.prepare(
				{ text: 'Hello World', noFormat: true },
				0, [], el, printer, 'test', true
			);
			assert.equal(result.text, 'Hello World');
			assert.equal(result.error, undefined);
		});

		it('renders a tree to text', () => {
			const el = elementDefault();
			const div = el.initName('div');
			el.childText(div, 'test content');
			const printer = new Printer({ elAdapter: el });
			const result = printerTransform.prepare(
				{ tree: [div] },
				0, [], el, printer, 'test', false
			);
			assert.ok(result.text && result.text.includes('test content'));
		});
	});

	describe('asyncMatcher - children replacement', () => {
		it('replaces children with a text string', async () => {
			const { tree, elAdapter } = parse('<html><head><title>Old Title</title></head><body></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: { name: 'title', path: ['html', 'head'] },
				callback: function(opt) {
					return opt.callback(null, {
						noFormat: true,
						children: { text: 'New Title', noFormat: true },
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('New Title'), 'should include new title');
			assert.ok(!result.includes('Old Title'), 'should not include old title');
		});

		it('replaces children with a tree of nodes', async () => {
			const { tree, elAdapter } = parse('<html><body><div>Old</div></body></html>');
			const el = elementDefault();
			const span = el.initName('span');
			el.childText(span, 'New');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: { name: 'div', path: ['html', 'body'] },
				callback: function(opt) {
					return opt.callback(null, {
						noFormat: true,
						children: { tree: [span], noFormat: true },
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('<span>'), 'should contain the span element');
			assert.ok(!result.includes('Old'), 'should not contain old content');
		});
	});

	describe('asyncMatcher - append', () => {
		it('appends a node tree at the end of an element', async () => {
			const { tree, elAdapter } = parse('<html><head></head><body></body></html>');
			const el = elementDefault();
			const link = el.initName('link');
			el.attrsAdd(link, { name: 'rel', value: 'stylesheet' });
			el.attrsAdd(link, { name: 'href', value: 'style.css' });
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: { name: 'head', path: ['html'] },
				callback: function(opt) {
					return opt.callback(null, {
						append: { tree: [link], noFormat: true },
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('<link'), 'should include appended link element');
			assert.ok(result.includes('<head>') || result.includes('<head '), 'head tag should still be present');
			// link should be inside head, not after </head>
			const headClose = result.indexOf('</head>');
			const linkPos = result.indexOf('<link');
			assert.ok(linkPos < headClose, 'link should appear before </head>');
		});
	});

	describe('asyncMatcher - before/after insertion', () => {
		it('inserts content before the matched tag', async () => {
			const { tree, elAdapter } = parse('<html><body><div id="main"></div></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: { name: 'div', attrs: [['id', 'main']], path: ['html', 'body'] },
				callback: function(opt) {
					return opt.callback(null, {
						before: { text: '<nav>Navigation</nav>', noFormat: true },
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('<nav>Navigation</nav>'), 'should include nav element');
			const navPos = result.indexOf('<nav>');
			const divPos = result.indexOf('<div');
			assert.ok(navPos < divPos, 'nav should appear before div');
		});

		it('inserts content after the matched tag', async () => {
			const { tree, elAdapter } = parse('<html><body><script src="/js/app.js"></script></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: {
					name: 'script',
					attrs: [['src', '/js/app.js'], [null, null, '<0>']],
					path: ['html', 'body'],
				},
				callback: function(opt) {
					return opt.callback(null, {
						after: { text: '<script src="/js/extra.js"></script>', noFormat: true },
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('/js/app.js'), 'should still include app.js');
			assert.ok(result.includes('/js/extra.js'), 'should include inserted extra.js');
			const appPos = result.indexOf('/js/app.js');
			const extraPos = result.indexOf('/js/extra.js');
			assert.ok(appPos < extraPos, 'app.js should appear before extra.js');
		});
	});

	describe('asyncMatcher - full replacement', () => {
		it('replaces the entire matched element with text', async () => {
			const { tree, elAdapter } = parse('<html><body><div id="old"></div></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: { name: 'div', attrs: [['id', 'old']], path: ['html', 'body'] },
				callback: function(opt) {
					return opt.callback(null, {
						full: { text: '<section id="new">Replaced</section>', noFormat: true },
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('<section id="new">'), 'should include the new section');
			assert.ok(!result.includes('<div id="old">'), 'should not include the old div');
		});

		it('replaces the entire matched element with a tree', async () => {
			const { tree, elAdapter } = parse('<html><body><p>Original</p></body></html>');
			const el = elementDefault();
			const section = el.initName('section');
			el.childText(section, 'Replacement');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: { name: 'p', path: ['html', 'body'] },
				callback: function(opt) {
					return opt.callback(null, {
						full: { tree: [section], noFormat: true },
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('<section>') || result.includes('<section'), 'should include section element');
			assert.ok(!result.includes('<p>'), 'should not include the original p tag');
		});
	});

	describe('asyncMatcher - no match', () => {
		it('prints node as-is when no rule matches', async () => {
			const { tree, elAdapter } = parse('<html><body><p>Hello</p></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: { name: 'div', path: ['html', 'body'] }, // won't match <p>
				callback: function(opt) {
					return opt.callback(null, { full: { text: 'REPLACED', noFormat: true } });
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('<p>'), 'should still include original p tag');
			assert.ok(result.includes('Hello'), 'should still include original content');
			assert.ok(!result.includes('REPLACED'), 'should not apply replacement');
		});
	});

	describe('asyncMatcher - clear()', () => {
		it('removes all rules so nodes print as-is', async () => {
			const { tree, elAdapter } = parse('<html><body><div>Content</div></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: { name: 'div', path: ['html', 'body'] },
				callback: function(opt) {
					return opt.callback(null, { full: { text: 'REPLACED', noFormat: true } });
				},
			});
			am.clear();
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(!result.includes('REPLACED'), 'cleared rule should not apply');
			assert.ok(result.includes('<div>'), 'original div should be present');
		});
	});

	describe('asyncMatcher - rule order and priority', () => {
		it('uses the first matching rule when multiple rules match', async () => {
			const { tree, elAdapter } = parse('<html><body><div id="target"></div></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: { name: 'div', path: ['html', 'body'] },
				callback: function(opt) {
					return opt.callback(null, { full: { text: '<p>First Rule</p>', noFormat: true } });
				},
			});
			am.addRule({
				matcher: { name: 'div', attrs: [['id', 'target']], path: ['html', 'body'] },
				callback: function(opt) {
					return opt.callback(null, { full: { text: '<p>Second Rule</p>', noFormat: true } });
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('First Rule'), 'first rule should win');
			assert.ok(!result.includes('Second Rule'), 'second rule should not apply');
		});

		it('only matched rule is applied, unmatched nodes are unchanged', async () => {
			const { tree, elAdapter } = parse('<html><body><h1>Title</h1><p>Para</p></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: { name: 'h1', path: ['html', 'body'] },
				callback: function(opt) {
					return opt.callback(null, {
						children: { text: 'Replaced Title', noFormat: true },
						noFormat: true,
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('Replaced Title'), 'h1 content should be replaced');
			assert.ok(result.includes('Para'), 'p content should be unchanged');
		});
	});

	describe('asyncMatcher - exclusive attribute matching', () => {
		it('matches element with ONLY the specified attribute (exclusive match pattern)', async () => {
			const { tree, elAdapter } = parse('<html><body><div id="root"></div><div id="root" class="extra"></div></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			let matchCount = 0;
			am.addRule({
				matcher: {
					name: 'div',
					attrs: [['id', 'root'], [null, null, '<0>']],
					path: ['html', 'body'],
				},
				callback: function(opt) {
					matchCount++;
					return opt.callback(null, null);
				},
			});
			await transformAsync(tree, elAdapter, am.transform);
			// Only the div with ONLY id="root" should match; the one with an extra class should not
			assert.equal(matchCount, 1, 'only the div with exactly id="root" should match');
		});
	});

	describe('asyncMatcher - custom isSuccess', () => {
		it('per-rule isSuccess override controls whether the rule applies', async () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			let callbackCalled = false;
			am.addRule({
				matcher: { name: 'div', path: ['html', 'body'] },
				isSuccess: function() { return false; }, // always rejects
				callback: function(opt) {
					callbackCalled = true;
					return opt.callback(null, null);
				},
			});
			await transformAsync(tree, elAdapter, am.transform);
			assert.equal(callbackCalled, false, 'callback should not be called when isSuccess returns false');
		});
	});

	describe('asyncMatcher - onTest hook', () => {
		it('onTest is called for every element node visited', async () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			let testCount = 0;
			am.onTest = function(opt) { testCount++; };
			am.addRule({
				matcher: { name: 'div', path: ['html', 'body'] },
				callback: function(opt) { return opt.callback(null, null); },
			});
			await transformAsync(tree, elAdapter, am.transform);
			assert.ok(testCount > 0, 'onTest should have been called at least once');
		});
	});

	describe('asyncMatcher - doc examples', () => {
		it('doc: replace div#root children (no other attrs, direct child of body)', async () => {
			const { tree, elAdapter } = parse('<html><body><div id="root"></div></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: {
					name: 'div',
					attrs: [['id', 'root'], [null, null, '<0>']],
					path: ['html', 'body'],
				},
				callback: function(opt) {
					return opt.callback(null, {
						noFormat: true,
						children: { text: '<div class="app--root">App</div>', noFormat: true },
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('app--root'), 'replaced content should be present');
			assert.ok(result.includes('<div id="root">') || result.includes('<div id="root"'), 'wrapper div should remain');
		});

		it('doc: append css links to head', async () => {
			const { tree, elAdapter } = parse('<html><head><meta charset="utf-8"></head><body></body></html>');
			const el = elementDefault();
			const link = el.initName('link');
			el.attrsAdd(link, { name: 'rel', value: 'stylesheet' });
			el.attrsAdd(link, { name: 'href', value: '/css/app.css' });
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: { name: 'head', path: ['html'] },
				callback: function(opt) {
					return opt.callback(null, { append: { tree: [link], noFormat: true } });
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('/css/app.css'), 'css link should be appended');
			assert.ok(result.includes('<meta'), 'original head content should be preserved');
		});

		it('doc: replace title text (no attrs), insert after matched script', async () => {
			const html = '<html><head><title>Old</title></head><body><script src="/js/index.js"></script></body></html>';
			const { tree, elAdapter } = parse(html);
			const am = printerTransform.asyncMatcher(elAdapter);
			// Replace title children (title must have no attrs)
			am.addRule({
				matcher: {
					name: 'title',
					attrs: [[null, null, '<0>']],
					path: ['html', 'head'],
				},
				callback: function(opt) {
					return opt.callback(null, {
						noFormat: true,
						children: { text: 'Replaced Title', noFormat: true },
					});
				},
			});
			// Insert after script with src=/js/index.js and no other attrs
			am.addRule({
				matcher: {
					name: 'script',
					attrs: [['src', '/js/index.js'], [null, null, '<0>']],
					path: ['html', 'body'],
				},
				callback: function(opt) {
					return opt.callback(null, {
						after: { text: '<script src="/js/extra.js"></script>', noFormat: true },
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('Replaced Title'), 'title should be replaced');
			assert.ok(!result.includes('Old'), 'old title should be gone');
			assert.ok(result.includes('/js/extra.js'), 'extra script should be inserted');
		});
	});

	describe('asyncMatcher - sibling selectors', () => {
		it('matches prevSibling adjacent rule and transforms node', async () => {
			const { tree, elAdapter } = parse('<html><head></head><body><p>Body</p></body></html>');
			const { node, path } = getNodeAndPath(tree[0], 'p', elAdapter);
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: {
					name: 'p',
					path: ['html', { name: 'body', prevSibling: ['head <1>'] }],
				},
				callback: function(opt) {
					return opt.callback(null, {
						full: { text: '<p>Replaced By Prev</p>', noFormat: true },
						noFormat: true,
					});
				},
			});
			const rep = await new Promise((resolve, reject) => {
				am.transform({
					node,
					path,
					level: 0,
					elAdapter,
					callback: function(err, out) {
						if (err) reject(err);
						else resolve(out);
					},
				});
			});
			assert.ok(rep && rep.full && rep.full.text.includes('Replaced By Prev'), 'prev sibling rule should apply');
		});

		it('matches next sibling wildcard-gap rule and transforms node', async () => {
			const { tree, elAdapter } = parse('<html><body><p>Body</p></body><section></section><aside></aside></html>');
			const { node, path } = getNodeAndPath(tree[0], 'p', elAdapter);
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: {
					name: 'p',
					path: ['html', { name: 'body', sibling: ['* <*>', 'aside <1>'] }],
				},
				callback: function(opt) {
					return opt.callback(null, {
						full: { text: '<p>Replaced By Next</p>', noFormat: true },
						noFormat: true,
					});
				},
			});
			const rep = await new Promise((resolve, reject) => {
				am.transform({
					node,
					path,
					level: 0,
					elAdapter,
					callback: function(err, out) {
						if (err) reject(err);
						else resolve(out);
					},
				});
			});
			assert.ok(rep && rep.full && rep.full.text.includes('Replaced By Next'), 'next sibling wildcard rule should apply');
		});

		it('does not apply when sibling rule does not match', async () => {
			const { tree, elAdapter } = parse('<html><body><p>Body</p></body><section></section></html>');
			const { node, path } = getNodeAndPath(tree[0], 'p', elAdapter);
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: {
					name: 'p',
					path: ['html', { name: 'body', sibling: ['aside <1>'] }],
				},
				callback: function(opt) {
					return opt.callback(null, {
						children: { text: 'SHOULD_NOT_APPLY', noFormat: true },
						noFormat: true,
					});
				},
			});
			const rep = await new Promise((resolve, reject) => {
				am.transform({
					node,
					path,
					level: 0,
					elAdapter,
					callback: function(err, out) {
						if (err) reject(err);
						else resolve(out);
					},
				});
			});
			assert.equal(rep, undefined, 'rule should not be applied');
		});
	});

	describe('asyncMatcher - sibling selectors (full transform integration)', () => {
		it('matches prevSibling on matched element', async () => {
			const { tree, elAdapter } = parse('<html><body><h1>Title</h1><p>Body</p></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: {
					name: 'p',
					path: ['html', 'body'],
					prevSibling: ['h1 <1>'],
				},
				callback: function(opt) {
					return opt.callback(null, {
						children: { text: 'Replaced Matched Prev', noFormat: true },
						noFormat: true,
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('Replaced Matched Prev'), 'matched-element prevSibling rule should apply');
			assert.ok(!result.includes('Body'), 'old content should be replaced');
		});

		it('matches sibling on matched element', async () => {
			const { tree, elAdapter } = parse('<html><body><p>Body</p><span>After</span></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: {
					name: 'p',
					path: ['html', 'body'],
					sibling: ['span <1>'],
				},
				callback: function(opt) {
					return opt.callback(null, {
						children: { text: 'Replaced Matched Next', noFormat: true },
						noFormat: true,
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('Replaced Matched Next'), 'matched-element sibling rule should apply');
			assert.ok(!result.includes('Body'), 'old content should be replaced');
		});

		it('matches prevSibling as path selector rule', async () => {
			const { tree, elAdapter } = parse('<html><head></head><body><p>Body</p></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: {
					name: 'p',
					path: ['html', { name: 'body', prevSibling: ['head <1>'] }],
				},
				callback: function(opt) {
					return opt.callback(null, {
						children: { text: 'Replaced By Prev', noFormat: true },
						noFormat: true,
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('Replaced By Prev'), 'prev sibling rule should apply');
			assert.ok(!result.includes('Body'), 'old content should be replaced');
		});

		it('matches sibling as path selector rule', async () => {
			const { tree, elAdapter } = parse('<html><body><p>Body</p></body><section></section><aside></aside></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: {
					name: 'p',
					path: ['html', { name: 'body', sibling: ['* <*>', 'aside <1>'] }],
				},
				callback: function(opt) {
					return opt.callback(null, {
						children: { text: 'Replaced By Next', noFormat: true },
						noFormat: true,
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('Replaced By Next'), 'next sibling wildcard rule should apply');
			assert.ok(!result.includes('Body'), 'old content should be replaced');
		});
	});

	describe('sync', () => {
		it('returns page output with no errors for pass-through transforms', () => {
			const { tree, elAdapter } = parse('<html><body><p>Hello</p></body></html>');
			const result = transformSync(tree, elAdapter, function() {});
			assert.equal(result.errors, null);
			assert.ok(result.page.includes('<p>'));
			assert.ok(result.page.includes('Hello'));
		});

		it('collects thrown transform errors', () => {
			const { tree, elAdapter } = parse('<html><body><p>Hello</p></body></html>');
			const result = transformSync(tree, elAdapter, function(opt) {
				if (opt.node && opt.elAdapter.nameGet(opt.node) === 'p') {
					throw new Error('sync transform failure');
				}
			});
			assert.ok(result.errors && result.errors.length === 1);
			assert.equal(result.errors[0].message, 'sync transform failure');
		});
	});

	describe('syncMatcher', () => {
		it('replaces children with a text string', () => {
			const { tree, elAdapter } = parse('<html><head><title>Old Title</title></head><body></body></html>');
			const sm = printerTransform.syncMatcher(elAdapter);
			sm.addRule({
				matcher: { name: 'title', path: ['html', 'head'] },
				callback: function() {
					return {
						noFormat: true,
						children: { text: 'New Title', noFormat: true },
					};
				},
			});
			const result = transformSync(tree, elAdapter, sm.transform);
			assert.equal(result.errors, null);
			assert.ok(result.page.includes('New Title'));
			assert.ok(!result.page.includes('Old Title'));
		});

		it('uses the first matching rule when multiple rules match', () => {
			const { tree, elAdapter } = parse('<html><body><div id="target"></div></body></html>');
			const sm = printerTransform.syncMatcher(elAdapter);
			sm.addRule({
				matcher: { name: 'div', path: ['html', 'body'] },
				callback: function() {
					return { full: { text: '<p>First Rule</p>', noFormat: true } };
				},
			});
			sm.addRule({
				matcher: { name: 'div', attrs: [['id', 'target']], path: ['html', 'body'] },
				callback: function() {
					return { full: { text: '<p>Second Rule</p>', noFormat: true } };
				},
			});
			const result = transformSync(tree, elAdapter, sm.transform);
			assert.equal(result.errors, null);
			assert.ok(result.page.includes('First Rule'));
			assert.ok(!result.page.includes('Second Rule'));
		});

		it('supports per-rule isSuccess override', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const sm = printerTransform.syncMatcher(elAdapter);
			let callbackCalled = false;
			sm.addRule({
				matcher: { name: 'div', path: ['html', 'body'] },
				isSuccess: function() { return false; },
				callback: function() {
					callbackCalled = true;
					return null;
				},
			});
			const result = transformSync(tree, elAdapter, sm.transform);
			assert.equal(result.errors, null);
			assert.equal(callbackCalled, false);
		});

		it('calls onTest for visited nodes', () => {
			const { tree, elAdapter } = parse('<html><body><div></div></body></html>');
			const sm = printerTransform.syncMatcher(elAdapter);
			let testCount = 0;
			sm.onTest = function() { testCount++; };
			sm.addRule({
				matcher: { name: 'div', path: ['html', 'body'] },
				callback: function() { return null; },
			});
			const result = transformSync(tree, elAdapter, sm.transform);
			assert.equal(result.errors, null);
			assert.ok(testCount > 0);
		});

		it('matches prevSibling adjacent rule and transforms node', () => {
			const { tree, elAdapter } = parse('<html><head></head><body><p>Body</p></body></html>');
			const sm = printerTransform.syncMatcher(elAdapter);
			sm.addRule({
				matcher: {
					name: 'p',
					path: ['html', { name: 'body', prevSibling: ['head <1>'] }],
				},
				callback: function() {
					return {
						children: { text: 'Sync Replaced Prev', noFormat: true },
						noFormat: true,
					};
				},
			});
			const result = transformSync(tree, elAdapter, sm.transform);
			assert.equal(result.errors, null);
			assert.ok(result.page.includes('Sync Replaced Prev'));
			assert.ok(!result.page.includes('Body'));
		});

		it('matches next sibling wildcard-gap rule and transforms node', () => {
			const { tree, elAdapter } = parse('<html><body><p>Body</p></body><section></section><aside></aside></html>');
			const sm = printerTransform.syncMatcher(elAdapter);
			sm.addRule({
				matcher: {
					name: 'p',
					path: ['html', { name: 'body', sibling: ['* <*>', 'aside <1>'] }],
				},
				callback: function() {
					return {
						children: { text: 'Sync Replaced Next', noFormat: true },
						noFormat: true,
					};
				},
			});
			const result = transformSync(tree, elAdapter, sm.transform);
			assert.equal(result.errors, null);
			assert.ok(result.page.includes('Sync Replaced Next'));
			assert.ok(!result.page.includes('Body'));
		});

		it('does not apply when prevSibling rule does not match', () => {
			const { tree, elAdapter } = parse('<html><section></section><body><p>Body</p></body></html>');
			const sm = printerTransform.syncMatcher(elAdapter);
			sm.addRule({
				matcher: {
					name: 'p',
					path: ['html', { name: 'body', prevSibling: ['head <1>'] }],
				},
				callback: function() {
					return {
						children: { text: 'SHOULD_NOT_APPLY_SYNC', noFormat: true },
						noFormat: true,
					};
				},
			});
			const result = transformSync(tree, elAdapter, sm.transform);
			assert.equal(result.errors, null);
			assert.ok(result.page.includes('Body'));
			assert.ok(!result.page.includes('SHOULD_NOT_APPLY_SYNC'));
		});
	});
});
