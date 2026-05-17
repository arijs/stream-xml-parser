import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getParser, printerTransform, elementDefault, TreeMatcher, Printer, treeWalk, getFullTreePath } from '../../src/index.mjs';

function parse(html) {
	const p = getParser();
	p.end(html);
	return p.getResult();
}

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

function addHookTestRule(matcher, mode) {
	matcher.addRule({
		matcher: {
			name: 'p',
			path: ['html', 'body'],
			prevSibling: ['h1 <1>'],
		},
		callback: 'async' === mode
			? function(opt) {
				return opt.callback(null, {
					children: { text: 'Replaced Matched Prev', noFormat: true },
					noFormat: true,
				});
			}
			: function() {
				return {
					children: { text: 'Sync Replaced Matched Prev', noFormat: true },
					noFormat: true,
				};
			},
	});
}

async function captureAsyncMatcherHooks() {
	const { tree, elAdapter } = parse('<html><body><h1>Title</h1><p>Body</p></body></html>');
	const matcher = printerTransform.asyncMatcher(elAdapter);
	let onTestCalls = [];
	let onTestRuleCalls = [];
	matcher.onTest = function(opt) {
		onTestCalls.push(opt);
	};
	matcher.onTestRule = function(result, success, rule, opt) {
		onTestRuleCalls.push({ result, success, rule, opt });
	};
	addHookTestRule(matcher, 'async');
	const result = await transformAsync(tree, elAdapter, matcher.transform);
	assert.ok(result.includes('Replaced Matched Prev'), 'matched-element prevSibling rule should apply');
	assert.ok(!result.includes('Body'), 'old content should be replaced');
	assert.ok(onTestCalls.length > 0, 'onTest should be called at least once');
	assert.ok(onTestRuleCalls.length > 0, 'onTestRule should be called at least once');
	return { elAdapter, onTestCalls, onTestRuleCalls };
}

function captureSyncMatcherHooks() {
	const { tree, elAdapter } = parse('<html><body><h1>Title</h1><p>Body</p></body></html>');
	const matcher = printerTransform.syncMatcher(elAdapter);
	let onTestCalls = [];
	let onTestRuleCalls = [];
	matcher.onTest = function(opt) {
		onTestCalls.push(opt);
	};
	matcher.onTestRule = function(result, success, rule, opt) {
		onTestRuleCalls.push({ result, success, rule, opt });
	};
	addHookTestRule(matcher, 'sync');
	const result = transformSync(tree, elAdapter, matcher.transform);
	assert.equal(result.errors, null, 'syncMatcher hook setup should not produce errors');
	assert.ok(result.page.includes('Sync Replaced Matched Prev'), 'matched-element prevSibling rule should apply');
	assert.ok(!result.page.includes('Body'), 'old content should be replaced');
	assert.ok(onTestCalls.length > 0, 'onTest should be called at least once');
	assert.ok(onTestRuleCalls.length > 0, 'onTestRule should be called at least once');
	return { elAdapter, onTestCalls, onTestRuleCalls };
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

		it('removes matched element when full is an empty replacement object', async () => {
			const { tree, elAdapter } = parse('<html><body><div>Keep</div><p>Remove Me</p></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: { name: 'p', path: ['html', 'body'] },
				callback: function(opt) {
					return opt.callback(null, {
						full: {},
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(!result.includes('<p>'), 'matched element should be removed');
			assert.ok(!result.includes('Remove Me'), 'matched element text should be removed');
			assert.ok(result.includes('Keep'), 'other content should remain');
		});

		it('removes children when children is an empty replacement object', async () => {
			const { tree, elAdapter } = parse('<html><body><div><span>Remove Child</span></div></body></html>');
			const am = printerTransform.asyncMatcher(elAdapter);
			am.addRule({
				matcher: { name: 'div', path: ['html', 'body'] },
				callback: function(opt) {
					return opt.callback(null, {
						children: {},
					});
				},
			});
			const result = await transformAsync(tree, elAdapter, am.transform);
			assert.ok(result.includes('<div>'), 'wrapper element should remain');
			assert.ok(!result.includes('<span>'), 'children should be removed');
			assert.ok(!result.includes('Remove Child'), 'children text should be removed');
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
		const { nodeEntry, path } = nodeAndPath(tree[0], 'p', elAdapter);
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
					node: nodeEntry,
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
		const { nodeEntry, path } = nodeAndPath(tree[0], 'p', elAdapter);
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
					node: nodeEntry,
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
		const { nodeEntry, path } = nodeAndPath(tree[0], 'p', elAdapter);
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
					node: nodeEntry,
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

	describe('asyncMatcher - onTest hooks', () => {
		async function getOnTestCalls() {
			const { elAdapter, onTestCalls } = await captureAsyncMatcherHooks();
			const [htmlCall, bodyCall, h1Call, pCall] = onTestCalls;
			return { elAdapter, onTestCalls, htmlCall, bodyCall, h1Call, pCall };
		}

		it('onTest provides node entries with underlying element nodes', async () => {
			const { onTestCalls } = await getOnTestCalls();
			for (const opt of onTestCalls) {
				assert.ok(opt.node, 'opt.node (nodeEntry) should be present');
				assert.strictEqual(typeof opt.node, 'object', 'opt.node should be an object');
				assert.ok(opt.node.node, 'opt.node.node (actual tree element) should be present');
				assert.strictEqual(typeof opt.node.node, 'object', 'opt.node.node should be an object');
			}
		});

		it('onTest provides path arrays with expected ancestry depth', async () => {
			const { onTestCalls, htmlCall, bodyCall, h1Call, pCall } = await getOnTestCalls();
			for (const opt of onTestCalls) {
				assert.ok(opt.path instanceof Array, 'opt.path should be an array');
			}
			assert.strictEqual(htmlCall.path.length, 0, 'root html path should be empty');
			assert.strictEqual(bodyCall.path.length, 1, 'body path should have one entry');
			assert.strictEqual(h1Call.path.length, 2, 'h1 path should have two entries');
			assert.strictEqual(pCall.path.length, 2, 'p path should have two entries');
		});

		it('onTest provides numeric levels with expected values', async () => {
			const { onTestCalls, htmlCall, bodyCall, h1Call, pCall } = await getOnTestCalls();
			for (const opt of onTestCalls) {
				assert.ok('number' === typeof opt.level && !isNaN(opt.level) && isFinite(opt.level), 'opt.level should be a number');
			}
			assert.strictEqual(htmlCall.level, 0, 'root html level should be 0');
			assert.strictEqual(bodyCall.level, 1, 'body level should be 1');
			assert.strictEqual(h1Call.level, 2, 'h1 level should be 2');
			assert.strictEqual(pCall.level, 2, 'p level should be 2');
		});

		it('onTest passes through the matcher elAdapter', async () => {
			const { elAdapter, onTestCalls } = await getOnTestCalls();
			for (const opt of onTestCalls) {
				assert.strictEqual(opt.elAdapter, elAdapter, 'opt.elAdapter should be the elAdapter passed to asyncMatcher');
			}
		});

		it('onTest provides a Printer instance', async () => {
			const { onTestCalls } = await getOnTestCalls();
			for (const opt of onTestCalls) {
				assert.ok(opt.printer instanceof Printer, 'opt.printer should be an instance of Printer');
			}
		});

		it('onTest provides a callback function', async () => {
			const { onTestCalls } = await getOnTestCalls();
			for (const opt of onTestCalls) {
				assert.ok(opt.callback instanceof Function, 'opt.callback should be a function');
			}
		});

		it('onTest provides parentNode metadata for root and non-root nodes', async () => {
			const { onTestCalls, htmlCall } = await getOnTestCalls();
			assert.strictEqual(typeof htmlCall.node.parentNode, 'object', 'root parentNode should have object type');
			assert.strictEqual(htmlCall.node.parentNode, null, 'root parentNode should be null');
			for (const opt of onTestCalls.slice(1)) {
				assert.ok(opt.node.parentNode, 'non-root node parentNode should be present');
			}
		});

		it('onTest provides childIndex metadata for sibling position', async () => {
			const { htmlCall, bodyCall, h1Call, pCall } = await getOnTestCalls();
			assert.strictEqual(htmlCall.node.childIndex, 0, 'root html childIndex should be 0');
			assert.strictEqual(bodyCall.node.childIndex, 0, 'body should be the first child of html');
			assert.strictEqual(h1Call.node.childIndex, 0, 'h1 should be the first child of body');
			assert.strictEqual(pCall.node.childIndex, 1, 'p should be the second child of body');
		});

		it('onTest provides childCount metadata for sibling totals', async () => {
			const { htmlCall, bodyCall, h1Call, pCall } = await getOnTestCalls();
			assert.strictEqual(htmlCall.node.childCount, 1, 'root html childCount should be 1');
			assert.strictEqual(bodyCall.node.childCount, 1, 'html should have one child');
			assert.strictEqual(h1Call.node.childCount, 2, 'body should have two children for h1');
			assert.strictEqual(pCall.node.childCount, 2, 'body should have two children for p');
		});

		it('onTest visits the expected element sequence', async () => {
			const { elAdapter, htmlCall, bodyCall, h1Call, pCall } = await getOnTestCalls();
			assert.strictEqual(elAdapter.nameGet(htmlCall.node.node), 'html', 'first onTest call should be html');
			assert.strictEqual(elAdapter.nameGet(bodyCall.node.node), 'body', 'second onTest call should be body');
			assert.strictEqual(elAdapter.nameGet(h1Call.node.node), 'h1', 'third onTest call should be h1');
			assert.strictEqual(elAdapter.nameGet(pCall.node.node), 'p', 'fourth onTest call should be p');
		});
	});

	describe('asyncMatcher - onTestRule hooks', () => {
		async function getOnTestRuleCalls() {
			const { elAdapter, onTestRuleCalls } = await captureAsyncMatcherHooks();
			const [htmlCall, bodyCall, h1Call, pCall] = onTestRuleCalls;
			return { elAdapter, onTestRuleCalls, htmlCall, bodyCall, h1Call, pCall };
		}

		describe('onTestRule result payload', () => {
			it('captures the html result fields', async () => {
				const { htmlCall } = await getOnTestRuleCalls();
				assert.ok('result' in htmlCall, 'html call should have result');
				assert.strictEqual(htmlCall.result.success, false, 'html result.success should be false');
				assert.strictEqual(typeof htmlCall.result.name, 'object', 'html result.name should be an object');
				assert.strictEqual(htmlCall.result.name.yes, 0, 'html result.name.yes should be 0');
				assert.strictEqual(htmlCall.result.name.not, 1, 'html result.name.not should be 1');
				assert.strictEqual(htmlCall.result.name.success, false, 'html result.name.success should be false');
				assert.strictEqual(htmlCall.result.attr, undefined, 'html result.attr should be undefined');
				assert.strictEqual(htmlCall.result.path, undefined, 'html result.path should be undefined');
				assert.strictEqual(htmlCall.result.nextSibling, undefined, 'html result.nextSibling should be undefined');
				assert.strictEqual(htmlCall.result.prevSibling, undefined, 'html result.prevSibling should be undefined');
			});

			it('captures the body result fields', async () => {
				const { bodyCall } = await getOnTestRuleCalls();
				assert.ok('result' in bodyCall, 'body call should have result');
				assert.strictEqual(bodyCall.result.success, false, 'body result.success should be false');
				assert.strictEqual(typeof bodyCall.result.name, 'object', 'body result.name should be an object');
				assert.strictEqual(bodyCall.result.name.yes, 0, 'body result.name.yes should be 0');
				assert.strictEqual(bodyCall.result.name.not, 1, 'body result.name.not should be 1');
				assert.strictEqual(bodyCall.result.name.success, false, 'body result.name.success should be false');
				assert.strictEqual(bodyCall.result.attr, undefined, 'body result.attr should be undefined');
				assert.strictEqual(bodyCall.result.path, undefined, 'body result.path should be undefined');
				assert.strictEqual(bodyCall.result.nextSibling, undefined, 'body result.nextSibling should be undefined');
				assert.strictEqual(bodyCall.result.prevSibling, undefined, 'body result.prevSibling should be undefined');
			});

			it('captures the h1 result fields', async () => {
				const { h1Call } = await getOnTestRuleCalls();
				assert.ok('result' in h1Call, 'h1 call should have result');
				assert.strictEqual(h1Call.result.success, false, 'h1 result.success should be false');
				assert.strictEqual(typeof h1Call.result.name, 'object', 'h1 result.name should be an object');
				assert.strictEqual(h1Call.result.name.yes, 0, 'h1 result.name.yes should be 0');
				assert.strictEqual(h1Call.result.name.not, 1, 'h1 result.name.not should be 1');
				assert.strictEqual(h1Call.result.name.success, false, 'h1 result.name.success should be false');
				assert.strictEqual(h1Call.result.attr, undefined, 'h1 result.attr should be undefined');
				assert.strictEqual(h1Call.result.path, undefined, 'h1 result.path should be undefined');
				assert.strictEqual(h1Call.result.nextSibling, undefined, 'h1 result.nextSibling should be undefined');
				assert.strictEqual(h1Call.result.prevSibling, undefined, 'h1 result.prevSibling should be undefined');
			});

			it('captures the p result fields', async () => {
				const { pCall } = await getOnTestRuleCalls();
				assert.ok('result' in pCall, 'p call should have result');
				assert.strictEqual(pCall.result.success, true, 'p result.success should be true');
				assert.strictEqual(typeof pCall.result.name, 'object', 'p result.name should be an object');
				assert.strictEqual(pCall.result.name.yes, 1, 'p result.name.yes should be 1');
				assert.strictEqual(pCall.result.name.not, 0, 'p result.name.not should be 0');
				assert.strictEqual(pCall.result.name.success, true, 'p result.name.success should be true');
				assert.strictEqual(typeof pCall.result.attr, 'object', 'p result.attr should be an object');
				assert.strictEqual(typeof pCall.result.attr.rules, 'object', 'p result.attr.rules should be an object');
				assert.strictEqual(typeof pCall.result.attr.count, 'object', 'p result.attr.count should be an object');
				assert.strictEqual(pCall.result.attr.nomatch, 0, 'p result.attr.nomatch should be 0');
				assert.strictEqual(pCall.result.attr.success, true, 'p result.attr.success should be true');
				assert.strictEqual(typeof pCall.result.path, 'object', 'p result.path should be an object');
				assert.strictEqual(pCall.result.path.yes, 1, 'p result.path.yes should be 1');
				assert.strictEqual(pCall.result.path.not, 0, 'p result.path.not should be 0');
				assert.strictEqual(pCall.result.path.success, true, 'p result.path.success should be true');

				assert.strictEqual(typeof pCall.result.nextSibling, 'object', 'p result.nextSibling should be an object');
				assert.strictEqual(pCall.result.nextSibling.success, true, 'p result.nextSibling.success should be true');
				assert.strictEqual(pCall.result.nextSibling.rulesCount, 0, 'p result.nextSibling.rulesCount should be 0');

				assert.strictEqual(typeof pCall.result.prevSibling, 'object', 'p result.prevSibling should be an object');
				assert.strictEqual(pCall.result.prevSibling.success, true, 'p result.prevSibling.success should be true');
				assert.strictEqual(pCall.result.prevSibling.failedCount, 0, 'p result.prevSibling.failedCount should be 0');
				assert.strictEqual(pCall.result.prevSibling.attemptsCount, 1, 'p result.prevSibling.attemptsCount should be 1');
				assert.strictEqual(typeof pCall.result.prevSibling.active, 'object', 'p result.prevSibling.active should be an object');
				assert.strictEqual(typeof pCall.result.prevSibling.failed, 'object', 'p result.prevSibling.failed should be an object');
				assert.strictEqual(typeof pCall.result.prevSibling.attempts, 'object', 'p result.prevSibling.attempts should be an object');
				assert.strictEqual(typeof pCall.result.prevSibling.active.testList, 'object', 'p result.prevSibling.active.testList should be an object');
				assert.strictEqual(typeof pCall.result.prevSibling.active.itemList, 'object', 'p result.prevSibling.active.itemList should be an object');
				assert.strictEqual(typeof pCall.result.prevSibling.active.matches, 'object', 'p result.prevSibling.active.matches should be an object');
				assert.strictEqual(typeof pCall.result.prevSibling.active.nextGroup, 'object', 'p result.prevSibling.active.nextGroup should be an object');
				assert.strictEqual(pCall.result.prevSibling.active.forked, false, 'p result.prevSibling.active.forked should be false');
			});
		});

		it('onTestRule provides a boolean success flag', async () => {
			const { onTestRuleCalls, htmlCall, bodyCall, h1Call, pCall } = await getOnTestRuleCalls();
			for (const call of onTestRuleCalls) {
				assert.strictEqual(typeof call.success, 'boolean', 'success should be boolean');
			}
			assert.strictEqual(htmlCall.success, false, 'html should not match the p rule');
			assert.strictEqual(bodyCall.success, false, 'body should not match the p rule');
			assert.strictEqual(h1Call.success, false, 'h1 should not match the p rule');
			assert.strictEqual(pCall.success, true, 'p should match the p rule');
		});

		it('onTestRule provides the matched rule and matcher', async () => {
			const { onTestRuleCalls } = await getOnTestRuleCalls();
			for (const call of onTestRuleCalls) {
				assert.ok(call.rule, 'call.rule should be present');
				assert.ok(call.rule.matcher, 'call.rule.matcher should be present');
			}
		});

		it('onTestRule provides the onTest opt object with node entries', async () => {
			const { onTestRuleCalls } = await getOnTestRuleCalls();
			for (const call of onTestRuleCalls) {
				assert.ok(call.opt, 'call.opt should be present');
				assert.ok(call.opt.node, 'call.opt.node should be present');
				assert.strictEqual(typeof call.opt.node, 'object', 'call.opt.node should be an object');
				assert.ok(call.opt.node.node, 'call.opt.node.node should be present');
			}
		});

		it('onTestRule passes through the matcher elAdapter', async () => {
			const { elAdapter, onTestRuleCalls } = await getOnTestRuleCalls();
			for (const call of onTestRuleCalls) {
				assert.strictEqual(call.opt.elAdapter, elAdapter, 'call.opt.elAdapter should be the elAdapter passed to asyncMatcher');
			}
		});

		it('onTestRule provides a Printer instance on opt', async () => {
			const { onTestRuleCalls } = await getOnTestRuleCalls();
			for (const call of onTestRuleCalls) {
				assert.ok(call.opt.printer instanceof Printer, 'call.opt.printer should be an instance of Printer');
			}
		});

		it('onTestRule provides a callback function on opt', async () => {
			const { onTestRuleCalls } = await getOnTestRuleCalls();
			for (const call of onTestRuleCalls) {
				assert.ok(call.opt.callback instanceof Function, 'call.opt.callback should be a function');
			}
		});

		it('onTestRule visits the expected element sequence through opt.node', async () => {
			const { elAdapter, htmlCall, bodyCall, h1Call, pCall } = await getOnTestRuleCalls();
			assert.strictEqual(elAdapter.nameGet(htmlCall.opt.node.node), 'html', 'first onTestRule call should be html');
			assert.strictEqual(elAdapter.nameGet(bodyCall.opt.node.node), 'body', 'second onTestRule call should be body');
			assert.strictEqual(elAdapter.nameGet(h1Call.opt.node.node), 'h1', 'third onTestRule call should be h1');
			assert.strictEqual(elAdapter.nameGet(pCall.opt.node.node), 'p', 'fourth onTestRule call should be p');
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
				var node = opt.node && opt.node.node;
				if (node && opt.elAdapter.nameGet(node) === 'p') {
					throw new Error('sync transform failure');
				}
			});
			assert.ok(result.errors && result.errors.length === 1);
			assert.equal(result.errors[0].message, 'sync transform failure');
		});
	});

	describe('syncMatcher', () => {
		describe('onTest hooks', () => {
			function getSyncOnTestCalls() {
				const { elAdapter, onTestCalls } = captureSyncMatcherHooks();
				const [htmlCall, bodyCall, h1Call, pCall] = onTestCalls;
				return { elAdapter, onTestCalls, htmlCall, bodyCall, h1Call, pCall };
			}

			it('provides node entries with underlying element nodes', () => {
				const { onTestCalls } = getSyncOnTestCalls();
				for (const opt of onTestCalls) {
					assert.ok(opt.node, 'opt.node (nodeEntry) should be present');
					assert.strictEqual(typeof opt.node, 'object', 'opt.node should be an object');
					assert.ok(opt.node.node, 'opt.node.node (actual tree element) should be present');
					assert.strictEqual(typeof opt.node.node, 'object', 'opt.node.node should be an object');
				}
			});

			it('provides path arrays with expected ancestry depth', () => {
				const { onTestCalls, htmlCall, bodyCall, h1Call, pCall } = getSyncOnTestCalls();
				for (const opt of onTestCalls) {
					assert.ok(opt.path instanceof Array, 'opt.path should be an array');
				}
				assert.strictEqual(htmlCall.path.length, 0, 'root html path should be empty');
				assert.strictEqual(bodyCall.path.length, 1, 'body path should have one entry');
				assert.strictEqual(h1Call.path.length, 2, 'h1 path should have two entries');
				assert.strictEqual(pCall.path.length, 2, 'p path should have two entries');
			});

			it('provides numeric levels with expected values', () => {
				const { onTestCalls, htmlCall, bodyCall, h1Call, pCall } = getSyncOnTestCalls();
				for (const opt of onTestCalls) {
					assert.ok('number' === typeof opt.level && !isNaN(opt.level) && isFinite(opt.level), 'opt.level should be a number');
				}
				assert.strictEqual(htmlCall.level, 0, 'root html level should be 0');
				assert.strictEqual(bodyCall.level, 1, 'body level should be 1');
				assert.strictEqual(h1Call.level, 2, 'h1 level should be 2');
				assert.strictEqual(pCall.level, 2, 'p level should be 2');
			});

			it('passes through the matcher elAdapter', () => {
				const { elAdapter, onTestCalls } = getSyncOnTestCalls();
				for (const opt of onTestCalls) {
					assert.strictEqual(opt.elAdapter, elAdapter, 'opt.elAdapter should be the elAdapter passed to syncMatcher');
				}
			});

			it('provides a Printer instance', () => {
				const { onTestCalls } = getSyncOnTestCalls();
				for (const opt of onTestCalls) {
					assert.ok(opt.printer instanceof Printer, 'opt.printer should be an instance of Printer');
				}
			});

			it('does not provide a callback function', () => {
				const { onTestCalls } = getSyncOnTestCalls();
				for (const opt of onTestCalls) {
					assert.strictEqual(opt.callback, undefined, 'opt.callback should be undefined in syncMatcher');
				}
			});

			it('provides parentNode metadata for root and non-root nodes', () => {
				const { onTestCalls, htmlCall } = getSyncOnTestCalls();
				assert.strictEqual(typeof htmlCall.node.parentNode, 'object', 'root parentNode should have object type');
				assert.strictEqual(htmlCall.node.parentNode, null, 'root parentNode should be null');
				for (const opt of onTestCalls.slice(1)) {
					assert.ok(opt.node.parentNode, 'non-root node parentNode should be present');
				}
			});

			it('provides childIndex metadata for sibling position', () => {
				const { htmlCall, bodyCall, h1Call, pCall } = getSyncOnTestCalls();
				assert.strictEqual(htmlCall.node.childIndex, 0, 'root html childIndex should be 0');
				assert.strictEqual(bodyCall.node.childIndex, 0, 'body should be the first child of html');
				assert.strictEqual(h1Call.node.childIndex, 0, 'h1 should be the first child of body');
				assert.strictEqual(pCall.node.childIndex, 1, 'p should be the second child of body');
			});

			it('provides childCount metadata for sibling totals', () => {
				const { htmlCall, bodyCall, h1Call, pCall } = getSyncOnTestCalls();
				assert.strictEqual(htmlCall.node.childCount, 1, 'root html childCount should be 1');
				assert.strictEqual(bodyCall.node.childCount, 1, 'html should have one child');
				assert.strictEqual(h1Call.node.childCount, 2, 'body should have two children for h1');
				assert.strictEqual(pCall.node.childCount, 2, 'body should have two children for p');
			});

			it('visits the expected element sequence', () => {
				const { elAdapter, htmlCall, bodyCall, h1Call, pCall } = getSyncOnTestCalls();
				assert.strictEqual(elAdapter.nameGet(htmlCall.node.node), 'html', 'first onTest call should be html');
				assert.strictEqual(elAdapter.nameGet(bodyCall.node.node), 'body', 'second onTest call should be body');
				assert.strictEqual(elAdapter.nameGet(h1Call.node.node), 'h1', 'third onTest call should be h1');
				assert.strictEqual(elAdapter.nameGet(pCall.node.node), 'p', 'fourth onTest call should be p');
			});
		});

		describe('onTestRule hooks', () => {
			function getSyncOnTestRuleCalls() {
				const { elAdapter, onTestRuleCalls } = captureSyncMatcherHooks();
				const [htmlCall, bodyCall, h1Call, pCall] = onTestRuleCalls;
				return { elAdapter, onTestRuleCalls, htmlCall, bodyCall, h1Call, pCall };
			}

			describe('result payload', () => {
				it('captures the html result fields', () => {
					const { htmlCall } = getSyncOnTestRuleCalls();
					assert.ok('result' in htmlCall, 'html call should have result');
					assert.strictEqual(htmlCall.result.success, false, 'html result.success should be false');
					assert.strictEqual(typeof htmlCall.result.name, 'object', 'html result.name should be an object');
					assert.strictEqual(htmlCall.result.name.yes, 0, 'html result.name.yes should be 0');
					assert.strictEqual(htmlCall.result.name.not, 1, 'html result.name.not should be 1');
					assert.strictEqual(htmlCall.result.name.success, false, 'html result.name.success should be false');
					assert.strictEqual(htmlCall.result.attr, undefined, 'html result.attr should be undefined');
					assert.strictEqual(htmlCall.result.path, undefined, 'html result.path should be undefined');
					assert.strictEqual(htmlCall.result.nextSibling, undefined, 'html result.nextSibling should be undefined');
					assert.strictEqual(htmlCall.result.prevSibling, undefined, 'html result.prevSibling should be undefined');
				});

				it('captures the body result fields', () => {
					const { bodyCall } = getSyncOnTestRuleCalls();
					assert.ok('result' in bodyCall, 'body call should have result');
					assert.strictEqual(bodyCall.result.success, false, 'body result.success should be false');
					assert.strictEqual(typeof bodyCall.result.name, 'object', 'body result.name should be an object');
					assert.strictEqual(bodyCall.result.name.yes, 0, 'body result.name.yes should be 0');
					assert.strictEqual(bodyCall.result.name.not, 1, 'body result.name.not should be 1');
					assert.strictEqual(bodyCall.result.name.success, false, 'body result.name.success should be false');
					assert.strictEqual(bodyCall.result.attr, undefined, 'body result.attr should be undefined');
					assert.strictEqual(bodyCall.result.path, undefined, 'body result.path should be undefined');
					assert.strictEqual(bodyCall.result.nextSibling, undefined, 'body result.nextSibling should be undefined');
					assert.strictEqual(bodyCall.result.prevSibling, undefined, 'body result.prevSibling should be undefined');
				});

				it('captures the h1 result fields', () => {
					const { h1Call } = getSyncOnTestRuleCalls();
					assert.ok('result' in h1Call, 'h1 call should have result');
					assert.strictEqual(h1Call.result.success, false, 'h1 result.success should be false');
					assert.strictEqual(typeof h1Call.result.name, 'object', 'h1 result.name should be an object');
					assert.strictEqual(h1Call.result.name.yes, 0, 'h1 result.name.yes should be 0');
					assert.strictEqual(h1Call.result.name.not, 1, 'h1 result.name.not should be 1');
					assert.strictEqual(h1Call.result.name.success, false, 'h1 result.name.success should be false');
					assert.strictEqual(h1Call.result.attr, undefined, 'h1 result.attr should be undefined');
					assert.strictEqual(h1Call.result.path, undefined, 'h1 result.path should be undefined');
					assert.strictEqual(h1Call.result.nextSibling, undefined, 'h1 result.nextSibling should be undefined');
					assert.strictEqual(h1Call.result.prevSibling, undefined, 'h1 result.prevSibling should be undefined');
				});

				it('captures the p result fields', () => {
					const { pCall } = getSyncOnTestRuleCalls();
					assert.ok('result' in pCall, 'p call should have result');
					assert.strictEqual(pCall.result.success, true, 'p result.success should be true');
					assert.strictEqual(typeof pCall.result.name, 'object', 'p result.name should be an object');
					assert.strictEqual(pCall.result.name.yes, 1, 'p result.name.yes should be 1');
					assert.strictEqual(pCall.result.name.not, 0, 'p result.name.not should be 0');
					assert.strictEqual(pCall.result.name.success, true, 'p result.name.success should be true');
					assert.strictEqual(typeof pCall.result.attr, 'object', 'p result.attr should be an object');
					assert.strictEqual(typeof pCall.result.attr.rules, 'object', 'p result.attr.rules should be an object');
					assert.strictEqual(typeof pCall.result.attr.count, 'object', 'p result.attr.count should be an object');
					assert.strictEqual(pCall.result.attr.nomatch, 0, 'p result.attr.nomatch should be 0');
					assert.strictEqual(pCall.result.attr.success, true, 'p result.attr.success should be true');
					assert.strictEqual(typeof pCall.result.path, 'object', 'p result.path should be an object');
					assert.strictEqual(pCall.result.path.yes, 1, 'p result.path.yes should be 1');
					assert.strictEqual(pCall.result.path.not, 0, 'p result.path.not should be 0');
					assert.strictEqual(pCall.result.path.success, true, 'p result.path.success should be true');

					assert.strictEqual(typeof pCall.result.nextSibling, 'object', 'p result.nextSibling should be an object');
					assert.strictEqual(pCall.result.nextSibling.success, true, 'p result.nextSibling.success should be true');
					assert.strictEqual(pCall.result.nextSibling.rulesCount, 0, 'p result.nextSibling.rulesCount should be 0');

					assert.strictEqual(typeof pCall.result.prevSibling, 'object', 'p result.prevSibling should be an object');
					assert.strictEqual(pCall.result.prevSibling.success, true, 'p result.prevSibling.success should be true');
					assert.strictEqual(pCall.result.prevSibling.failedCount, 0, 'p result.prevSibling.failedCount should be 0');
					assert.strictEqual(pCall.result.prevSibling.attemptsCount, 1, 'p result.prevSibling.attemptsCount should be 1');
					assert.strictEqual(typeof pCall.result.prevSibling.active, 'object', 'p result.prevSibling.active should be an object');
					assert.strictEqual(typeof pCall.result.prevSibling.failed, 'object', 'p result.prevSibling.failed should be an object');
					assert.strictEqual(typeof pCall.result.prevSibling.attempts, 'object', 'p result.prevSibling.attempts should be an object');
					assert.strictEqual(typeof pCall.result.prevSibling.active.testList, 'object', 'p result.prevSibling.active.testList should be an object');
					assert.strictEqual(typeof pCall.result.prevSibling.active.itemList, 'object', 'p result.prevSibling.active.itemList should be an object');
					assert.strictEqual(typeof pCall.result.prevSibling.active.matches, 'object', 'p result.prevSibling.active.matches should be an object');
					assert.strictEqual(typeof pCall.result.prevSibling.active.nextGroup, 'object', 'p result.prevSibling.active.nextGroup should be an object');
					assert.strictEqual(pCall.result.prevSibling.active.forked, false, 'p result.prevSibling.active.forked should be false');
				});
			});

			it('provides a boolean success flag', () => {
				const { onTestRuleCalls, htmlCall, bodyCall, h1Call, pCall } = getSyncOnTestRuleCalls();
				for (const call of onTestRuleCalls) {
					assert.strictEqual(typeof call.success, 'boolean', 'success should be boolean');
				}
				assert.strictEqual(htmlCall.success, false, 'html should not match the p rule');
				assert.strictEqual(bodyCall.success, false, 'body should not match the p rule');
				assert.strictEqual(h1Call.success, false, 'h1 should not match the p rule');
				assert.strictEqual(pCall.success, true, 'p should match the p rule');
			});

			it('provides the matched rule and matcher', () => {
				const { onTestRuleCalls } = getSyncOnTestRuleCalls();
				for (const call of onTestRuleCalls) {
					assert.ok(call.rule, 'call.rule should be present');
					assert.ok(call.rule.matcher, 'call.rule.matcher should be present');
				}
			});

			it('provides the onTest opt object with node entries', () => {
				const { onTestRuleCalls } = getSyncOnTestRuleCalls();
				for (const call of onTestRuleCalls) {
					assert.ok(call.opt, 'call.opt should be present');
					assert.ok(call.opt.node, 'call.opt.node should be present');
					assert.strictEqual(typeof call.opt.node, 'object', 'call.opt.node should be an object');
					assert.ok(call.opt.node.node, 'call.opt.node.node should be present');
				}
			});

			it('passes through the matcher elAdapter', () => {
				const { elAdapter, onTestRuleCalls } = getSyncOnTestRuleCalls();
				for (const call of onTestRuleCalls) {
					assert.strictEqual(call.opt.elAdapter, elAdapter, 'call.opt.elAdapter should be the elAdapter passed to syncMatcher');
				}
			});

			it('provides a Printer instance on opt', () => {
				const { onTestRuleCalls } = getSyncOnTestRuleCalls();
				for (const call of onTestRuleCalls) {
					assert.ok(call.opt.printer instanceof Printer, 'call.opt.printer should be an instance of Printer');
				}
			});

			it('does not provide a callback function on opt', () => {
				const { onTestRuleCalls } = getSyncOnTestRuleCalls();
				for (const call of onTestRuleCalls) {
					assert.strictEqual(call.opt.callback, undefined, 'call.opt.callback should be undefined in syncMatcher');
				}
			});

			it('visits the expected element sequence through opt.node', () => {
				const { elAdapter, htmlCall, bodyCall, h1Call, pCall } = getSyncOnTestRuleCalls();
				assert.strictEqual(elAdapter.nameGet(htmlCall.opt.node.node), 'html', 'first onTestRule call should be html');
				assert.strictEqual(elAdapter.nameGet(bodyCall.opt.node.node), 'body', 'second onTestRule call should be body');
				assert.strictEqual(elAdapter.nameGet(h1Call.opt.node.node), 'h1', 'third onTestRule call should be h1');
				assert.strictEqual(elAdapter.nameGet(pCall.opt.node.node), 'p', 'fourth onTestRule call should be p');
			});
		});

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

		it('removes matched element when full is an empty replacement object', () => {
			const { tree, elAdapter } = parse('<html><body><div>Keep</div><p>Remove Me</p></body></html>');
			const sm = printerTransform.syncMatcher(elAdapter);
			sm.addRule({
				matcher: { name: 'p', path: ['html', 'body'] },
				callback: function() {
					return {
						full: {},
					};
				},
			});
			const result = transformSync(tree, elAdapter, sm.transform);
			assert.equal(result.errors, null);
			assert.ok(!result.page.includes('<p>'), 'matched element should be removed');
			assert.ok(!result.page.includes('Remove Me'), 'matched element text should be removed');
			assert.ok(result.page.includes('Keep'), 'other content should remain');
		});

		it('removes children when children is an empty replacement object', () => {
			const { tree, elAdapter } = parse('<html><body><div><span>Remove Child</span></div></body></html>');
			const sm = printerTransform.syncMatcher(elAdapter);
			sm.addRule({
				matcher: { name: 'div', path: ['html', 'body'] },
				callback: function() {
					return {
						children: {},
					};
				},
			});
			const result = transformSync(tree, elAdapter, sm.transform);
			assert.equal(result.errors, null);
			assert.ok(result.page.includes('<div>'), 'wrapper element should remain');
			assert.ok(!result.page.includes('<span>'), 'children should be removed');
			assert.ok(!result.page.includes('Remove Child'), 'children text should be removed');
		});

		it('removes multiple elements from a single rule', () => {
			const { tree, elAdapter } = parse('<html><head><title>Old Title</title></head><body><a><a1></a1></a><b><b1></b1></b><c><c1></c1></c></body></html>');
			const sm = printerTransform.syncMatcher(elAdapter);
			sm.addRule({
				matcher: TreeMatcher.fromArray([
					{ name: 'title', path: ['html', 'head'] },
					{ name: 'a1', path: ['html', 'body', 'a'] },
					{ name: 'c1', path: ['html', 'body', 'c'] },
				], elAdapter),
				callback: function() {
					return {
						noFormat: true,
						full: { noFormat: true },
					};
				},
			});
			const result = printerTransform.sync({
				tree, elAdapter, transform: sm.transform,
			});
			// transformSync(tree, elAdapter, sm.transform);
			assert.equal(result.errors, null);
			assert.ok(!result.page.includes('<title>'), 'Title open tag should be removed');
			assert.ok(!result.page.includes('</title>'), 'Title close tag should be removed');
			assert.ok(!result.page.includes('Old Title'), 'Old Title should be removed');
			assert.ok(!result.page.includes('<a1>'), '<a1> open tag should be removed');
			assert.ok(!result.page.includes('</a1>'), '<a1> close tag should be removed');
			assert.ok(!result.page.includes('<c1>'), '<c1> open tag should be removed');
			assert.ok(!result.page.includes('</c1>'), '<c1> close tag should be removed');
			assert.ok(result.page.includes('<a>'), '<a> open tag should remain');
			assert.ok(result.page.includes('</a>'), '</a> close tag should remain');
			assert.ok(result.page.includes('<b>'), '<b> open tag should remain');
			assert.ok(result.page.includes('<b1></b1>'), '<b1> tag should remain');
			assert.ok(result.page.includes('</b>'), '</b> close tag should remain');
			assert.ok(result.page.includes('<c>'), '<c> open tag should remain');
			assert.ok(result.page.includes('</c>'), '</c> close tag should remain');
		});
	});
});
