import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getParser, treeWalk, getFullTreePath, getMatcherFromCssSelector } from '../../src/index.mjs';
import {
	extractNodeTexts,
	extractNodeTextsNoWalk,
	getNodeCtx,
	buildNodeEntry,
	buildNodeEntryFromPath,
	getAttr,
	onTextNodeCollectDefault,
	extractText,
	findFirstDescendant,
	treeWalkIsSkip,
	treeWalkIsAbort,
	treeWalkIsRemove,
} from '../../src/treewalk.mjs';

function parse(html) {
	const p = getParser();
	p.end(html);
	return p.getResult();
}

describe('treeWalk', () => {
	describe('basic traversal', () => {
		it('visits all element nodes', () => {
			const { tree, elAdapter } = parse('<div><span></span><p></p></div>');
			const visited = [];
			treeWalk({
				node: tree[0],
				elAdapter,
				walkFns: {
					onNode: ({ node }) => visited.push(elAdapter.nameGet(node.node)),
				},
			});
			assert.deepEqual(visited, ['div', 'span', 'p']);
		});

		it('visits text nodes via onText', () => {
			const { tree, elAdapter } = parse('<div>hello</div>');
			const texts = [];
			treeWalk({
				node: tree[0],
				elAdapter,
				walkFns: {
					onText: ({ node }) => texts.push(elAdapter.textValueGet(node.node)),
				},
			});
			assert.deepEqual(texts, ['hello']);
		});

		it('visits comment nodes via onComment', () => {
			const { tree, elAdapter } = parse('<div><!-- my comment --></div>');
			const comments = [];
			treeWalk({
				node: tree[0],
				elAdapter,
				walkFns: {
					onComment: ({ node }) => comments.push(elAdapter.textValueGet(node.node)),
				},
			});
			assert.deepEqual(comments, [' my comment ']);
		});

		it('passes correct path to onNode', () => {
			const { tree, elAdapter } = parse('<div><span></span></div>');
			const paths = [];
			treeWalk({
				node: tree[0],
				elAdapter,
				walkFns: {
					onNode: ({ path }) => {
						paths.push(path.map(n => elAdapter.nameGet(n.node)));
					},
				},
			});
			assert.deepEqual(paths, [
				[],      // div at root
				['div'], // span under div
			]);
		});

		it('passes elAdapter as third argument to callbacks', () => {
			const { tree, elAdapter } = parse('<div></div>');
			let passedAdapter = null;
			treeWalk({
				node: tree[0],
				elAdapter,
				walkFns: {
					onNode: ({ elAdapter: adapter }) => { passedAdapter = adapter; },
				},
			});
			assert.equal(passedAdapter, elAdapter);
		});
	});

	describe('skip control', () => {
		it('skip() prevents visiting children of a node', () => {
			const { tree, elAdapter } = parse('<div><span><em>deep</em></span></div>');
			const visited = [];
			treeWalk({
				node: tree[0],
				elAdapter,
				walkFns: {
					onNode: function({ node }) {
						const name = elAdapter.nameGet(node.node);
						visited.push(name);
						if (name === 'span') this.skip();
					},
				},
			});
			assert.ok(visited.includes('div'));
			assert.ok(visited.includes('span'));
			assert.ok(!visited.includes('em'), 'children of skipped node should not be visited');
		});
	});

	describe('abort control', () => {
		it('abort() stops the entire walk', () => {
			const { tree, elAdapter } = parse('<div><a></a><b></b><c></c></div>');
			const visited = [];
			treeWalk({
				node: tree[0],
				elAdapter,
				walkFns: {
					onNode: function({ node }) {
						const name = elAdapter.nameGet(node.node);
						visited.push(name);
						if (name === 'a') this.abort();
					},
				},
			});
			assert.ok(visited.includes('div'));
			assert.ok(visited.includes('a'));
			assert.ok(!visited.includes('b'), 'nodes after abort should not be visited');
			assert.ok(!visited.includes('c'), 'nodes after abort should not be visited');
		});
	});

	describe('remove control', () => {
		it('remove() removes the current node from its parent', () => {
			const { tree, elAdapter } = parse('<div><span></span><p></p></div>');
			const div = tree[0];
			treeWalk({
				node: div,
				elAdapter,
				walkFns: {
					onNode: function({ node }) {
						if (elAdapter.nameGet(node.node) === 'span') {
							this.remove();
						}
					},
				},
			});
			assert.equal(elAdapter.childCount(div), 1);
			assert.equal(elAdapter.nameGet(elAdapter.childIndexGet(div, 0)), 'p');
		});

		it('remove() removes text nodes', () => {
			const { tree, elAdapter } = parse('<div>text<span></span></div>');
			const div = tree[0];
			treeWalk({
				node: div,
				elAdapter,
				walkFns: {
					onText: function() {
						this.remove();
					},
				},
			});
			assert.equal(elAdapter.childCount(div), 1);
			assert.equal(elAdapter.nameGet(elAdapter.childIndexGet(div, 0)), 'span');
		});
	});

	describe('tree array input', () => {
		it('walks array of nodes when elAdapter.isChildren returns true', () => {
			const { tree, elAdapter } = parse('<a></a><b></b>');
			const visited = [];
			// Walk each node individually when passed an array
			tree.forEach(node => {
				treeWalk({
					node,
					elAdapter,
					walkFns: {
						onNode: ({ node }) => visited.push(elAdapter.nameGet(node.node)),
					},
				});
			});
			assert.deepEqual(visited, ['a', 'b']);
		});
	});

	describe('declaration and instruction nodes', () => {
		it('visits declaration nodes via onDeclaration', () => {
			const { tree, elAdapter } = parse('<!DOCTYPE html><html></html>');
			const decls = [];
			tree.forEach(node => {
				treeWalk({
					node,
					elAdapter,
					walkFns: {
						onDeclaration: ({ node }) => decls.push(elAdapter.textValueGet(node.node)),
						onNode: () => {},
					},
				});
			});
			assert.ok(decls.length > 0);
		});

		it('visits instruction nodes via onInstruction', () => {
			const { tree, elAdapter } = parse('<?xml version="1.0"?><root></root>');
			const instrs = [];
			tree.forEach(node => {
				treeWalk({
					node,
					elAdapter,
					walkFns: {
						onInstruction: ({ node }) => instrs.push(elAdapter.textValueGet(node.node)),
						onNode: () => {},
					},
				});
			});
			assert.ok(instrs.length > 0);
		});
	});

	describe('onNodeExit', () => {
		it('runs after children in post-order traversal', () => {
			const { tree, elAdapter } = parse('<div><span><em></em></span><p></p></div>');
			const order = [];

			treeWalk({
				node: tree[0],
				elAdapter,
				walkFns: {
					onNode: ({ node }) => order.push(`enter:${elAdapter.nameGet(node.node)}`),
					onNodeExit: ({ node }) => order.push(`exit:${elAdapter.nameGet(node.node)}`),
				},
			});

			assert.deepEqual(order, [
				'enter:div',
				'enter:span',
				'enter:em',
				'exit:em',
				'exit:span',
				'enter:p',
				'exit:p',
				'exit:div',
			]);
		});

		it('does not run for the aborted node or its pending ancestors', () => {
			const { tree, elAdapter } = parse('<div><span><em></em></span><p></p></div>');
			const order = [];

			treeWalk({
				node: tree[0],
				elAdapter,
				walkFns: {
					onNode: function({ node }) {
						const name = elAdapter.nameGet(node.node);
						order.push(`enter:${name}`);
						if (name === 'em') this.abort();
					},
					onNodeExit: ({ node }) => order.push(`exit:${elAdapter.nameGet(node.node)}`),
				},
			});

			assert.deepEqual(order, [
				'enter:div',
				'enter:span',
				'enter:em',
				// abort: no exit for em, span, or div
			]);
		});

		it('still runs when node is skipped', () => {
			const { tree, elAdapter } = parse('<div><span><em></em></span></div>');
			const order = [];

			treeWalk({
				node: tree[0],
				elAdapter,
				walkFns: {
					onNode: function({ node }) {
						const name = elAdapter.nameGet(node.node);
						order.push(`enter:${name}`);
						if (name === 'span') this.skip();
					},
					onNodeExit: ({ node }) => order.push(`exit:${elAdapter.nameGet(node.node)}`),
				},
			});

			assert.deepEqual(order, [
				'enter:div',
				'enter:span',
				'exit:span',
				'exit:div',
			]);
		});
	});

	describe('walkCtx', () => {
		it('passes the same walkCtx object to all callbacks', () => {
			const { tree, elAdapter } = parse('<div><span>hello</span><p>world</p></div>');
			const walkCtx = { seen: [] };

			treeWalk({
				node: tree[0],
				elAdapter,
				walkCtx,
				walkFns: {
					onNode: ({ node, walkCtx: callbackWalkCtx }) => {
						callbackWalkCtx.seen.push(elAdapter.nameGet(node.node));
					},
					onText: ({ node, walkCtx: callbackWalkCtx }) => {
						callbackWalkCtx.seen.push(`#text:${elAdapter.textValueGet(node.node)}`);
					},
				},
			});

			assert.equal(walkCtx.seen.length, 5);
			assert.deepEqual(walkCtx.seen, ['div', 'span', '#text:hello', 'p', '#text:world']);
		});

		it('exposes walkCtx on callback this context', () => {
			const { tree, elAdapter } = parse('<div><a></a><b></b></div>');
			const walkCtx = { nodeCount: 0 };

			treeWalk({
				node: tree[0],
				elAdapter,
				walkCtx,
				walkFns: {
					onNode: function() {
						this.walkCtx.nodeCount++;
					},
				},
			});

			assert.equal(walkCtx.nodeCount, 3);
		});
	});

	describe('getFullTreePath', () => {
		it('returns a node and its path from the root', () => {
			const { tree, elAdapter } = parse('<div><span><a/><b/><em>deep</em><c/></span></div>');
			const { node, path } = getFullTreePath(tree[0], ({ node }) => elAdapter.nameGet(node.node) === 'em', elAdapter);
			const result = [...path, node];

			assert.deepEqual(result.map(e => elAdapter.nameGet(e.node)), ['div', 'span', 'em']);
			assert.deepEqual(result.map(e => e.parentNode && elAdapter.nameGet(e.parentNode)), [undefined, 'div', 'span']);
			assert.deepEqual(result.map(e => e.childIndex), [null, 0, 2]);
			assert.deepEqual(result.map(e => e.childCount), [null, 1, 4]);
		});
	});

	describe('auxiliary helpers', () => {
		describe('flag helpers', () => {
			it('treeWalkIsSkip/Abort/Remove detect their bit flags', () => {
				assert.equal(treeWalkIsSkip(1), 1);
				assert.equal(treeWalkIsAbort(2), 2);
				assert.equal(treeWalkIsRemove(4), 4);
			});

			it('treeWalkIsSkip/Abort/Remove return falsy when flag is absent', () => {
				assert.equal(treeWalkIsSkip(2), 0);
				assert.equal(treeWalkIsAbort(1), 0);
				assert.equal(treeWalkIsRemove(1 | 2), 0);
			});
		});

		describe('node entry builders', () => {
			it('getNodeCtx returns index/count pair', () => {
				assert.deepEqual(getNodeCtx(2, 5), { index: 2, count: 5 });
			});

			it('buildNodeEntry includes parent and child metadata when ctx exists', () => {
				const entry = buildNodeEntry('child', 'parent', getNodeCtx(1, 3));
				assert.deepEqual(entry, {
					node: 'child',
					parentNode: 'parent',
					childIndex: 1,
					childCount: 3,
				});
			});

			it('buildNodeEntry sets child metadata to null when ctx is missing', () => {
				const entry = buildNodeEntry('child', null, null);
				assert.equal(entry.childIndex, null);
				assert.equal(entry.childCount, null);
			});

			it('buildNodeEntryFromPath derives parent from previous path item', () => {
				const path = ['div', 'span', 'em'];
				const pathCtx = [null, getNodeCtx(0, 1), getNodeCtx(2, 4)];
				const entry = buildNodeEntryFromPath(path, pathCtx, 2);
				assert.equal(entry.node, 'em');
				assert.equal(entry.parentNode, 'span');
				assert.equal(entry.childIndex, 2);
				assert.equal(entry.childCount, 4);
			});

			it('buildNodeEntryFromPath uses null parent for first item', () => {
				const path = ['root'];
				const pathCtx = [getNodeCtx(0, 1)];
				const entry = buildNodeEntryFromPath(path, pathCtx, 0);
				assert.equal(entry.parentNode, null);
			});
		});

		describe('text and attr helpers', () => {
			it('onTextNodeCollectDefault joins and trims chunks', () => {
				assert.equal(onTextNodeCollectDefault(['  a', 'b  ']), 'ab');
			});

			it('onTextNodeCollectDefault returns empty string for whitespace-only chunks', () => {
				assert.equal(onTextNodeCollectDefault(['   ', '\n', '\t']), '');
			});

			it('extractText returns concatenated text for nested content', () => {
				const { tree, elAdapter } = parse('<div>hello <span>world</span></div>');
				assert.equal(extractText({ node: tree[0], elAdapter }), 'hello world');
			});

			it('extractText can use a custom collector', () => {
				const { tree, elAdapter } = parse('<div>a<b>1</b></div>');
				const text = extractText({
					node: tree[0],
					elAdapter,
					onCollect: chunks => chunks.join('|'),
				});
				assert.equal(text, 'a|1');
			});

			it('getAttr returns attribute value by exact name (case-insensitive)', () => {
				const { tree, elAdapter } = parse('<div DATA-ID="123"></div>');
				assert.equal(getAttr({ node: tree[0], elAdapter, targetName: 'data-id' }), '123');
			});

			it('getAttr supports function predicate and returns undefined when not found', () => {
				const { tree, elAdapter } = parse('<div class="x"></div>');
				const found = getAttr({
					node: tree[0],
					elAdapter,
					targetName: (name, value) => name === 'class' && value === 'x',
				});
				const missing = getAttr({ node: tree[0], elAdapter, targetName: 'id' });
				assert.equal(found, 'x');
				assert.equal(missing, undefined);
			});
		});

		describe('findFirstDescendant', () => {
			it('returns the first matching descendant at any level', () => {
				const { tree, elAdapter } = parse('<div><a></a><span><a id="target"></a></span></div>');
				const matcher = getMatcherFromCssSelector('a', elAdapter);
				const found = findFirstDescendant({ root: tree[0], elAdapter, matcher });
				assert.equal(elAdapter.nameGet(found), 'a');
				assert.equal(getAttr({ node: found, elAdapter, targetName: 'id' }), undefined, 'should find first a at direct level');
			});

			it('finds deeper descendants when no direct match exists', () => {
				const { tree, elAdapter } = parse('<div><span><a></a></span></div>');
				const matcher = getMatcherFromCssSelector('a', elAdapter);
				const found = findFirstDescendant({ root: tree[0], elAdapter, matcher });
				assert.equal(elAdapter.nameGet(found), 'a');
			});

		it('allows onAfterTest to call entry.skip() to skip branches', () => {
			const { tree, elAdapter } = parse('<div><span><a id="hidden"></a></span><section><a id="found"></a></section></div>');
			const matcher = getMatcherFromCssSelector('a', elAdapter);
			const onAfterTest = ({ node, skip }) => {
				const nodeName = elAdapter.nameGet(node.node);
				if (nodeName === 'span') {
					skip();
				}
			};
			const found = findFirstDescendant({ root: tree[0], elAdapter, matcher, onAfterTest });
			assert.equal(elAdapter.nameGet(found), 'a');
			assert.equal(getAttr({ node: found, elAdapter, targetName: 'id' }), 'found', 'should skip span and find a in section');
			});
		});
	});

	describe('extract node texts helpers', () => {
		it('extracts text from each direct child when no matcher is provided', () => {
			const { tree, elAdapter } = parse('<table><td>one</td><td>two</td><td>three</td></table>');
			const root = tree[0];

			const walked = extractNodeTexts({ node: root, elAdapter });
			const noWalk = extractNodeTextsNoWalk({ node: root, elAdapter });

			assert.deepEqual(walked, ['one', 'two', 'three']);
			assert.deepEqual(noWalk, ['one', 'two', 'three']);
			assert.deepEqual(walked, noWalk);
		});

		it('applies matcher filtering and returns only matching child texts', () => {
			const { tree, elAdapter } = parse('<table><td>a</td><th>skip</th><td>b</td></table>');
			const root = tree[0];
			const matcher = getMatcherFromCssSelector('td', elAdapter);

			const walked = extractNodeTexts({ node: root, elAdapter, rootMatcher: matcher });
			const noWalk = extractNodeTextsNoWalk({ node: root, elAdapter, rootMatcher: matcher });

			assert.deepEqual(walked, ['a', 'b']);
			assert.deepEqual(noWalk, ['a', 'b']);
			assert.deepEqual(walked, noWalk);
		});

		it('returns an empty list when matcher excludes all children', () => {
			const { tree, elAdapter } = parse('<table><td>a</td><td>b</td></table>');
			const root = tree[0];
			const matcher = getMatcherFromCssSelector('th', elAdapter);

			const walked = extractNodeTexts({ node: root, elAdapter, rootMatcher: matcher });
			const noWalk = extractNodeTextsNoWalk({ node: root, elAdapter, rootMatcher: matcher });

			assert.deepEqual(walked, []);
			assert.deepEqual(noWalk, []);
			assert.deepEqual(walked, noWalk);
		});

		it('uses custom collector consistently in both implementations', () => {
			const { tree, elAdapter } = parse('<table><td>a<b>1</b></td><td>b<c>2</c></td></table>');
			const root = tree[0];
			const onNodeCollect = chunks => chunks.join('|');

			const walked = extractNodeTexts({ node: root, elAdapter, onNodeCollect });
			const noWalk = extractNodeTextsNoWalk({ node: root, elAdapter, onNodeCollect });

			assert.deepEqual(walked, ['a|1', 'b|2']);
			assert.deepEqual(noWalk, ['a|1', 'b|2']);
			assert.deepEqual(walked, noWalk);
		});

		it('supports entry argument in onNodeCollect to return structured objects', () => {
			const { tree, elAdapter } = parse('<table><td>a<b>1</b></td><th>x<i>9</i></th></table>');
			const root = tree[0];
			const onNodeCollect = (chunks, entry) => ({
				text: chunks.join('|'),
				nodeName: entry.elAdapter.nameGet(entry.node.node),
				pathNodeType: entry.path.map(p => typeof p.node).join('>'),
				pathParentNodeType: entry.path.map(p => typeof p.parentNode).join('>'),
				pathChildIndex: entry.path.map(p => p.childIndex).join('>'),
				pathChildCount: entry.path.map(p => p.childCount).join('>'),
			});

			const walked = extractNodeTexts({ node: root, elAdapter, onNodeCollect });
			const noWalk = extractNodeTextsNoWalk({ node: root, elAdapter, onNodeCollect });

			assert.deepEqual(walked, [
				{ text: 'a|1', nodeName: 'td', pathNodeType: 'object', pathParentNodeType: 'undefined', pathChildIndex: '', pathChildCount: '' },
				{ text: 'x|9', nodeName: 'th', pathNodeType: 'object', pathParentNodeType: 'undefined', pathChildIndex: '', pathChildCount: '' },
			]);
			assert.deepEqual(noWalk, [
				{ text: 'a|1', nodeName: 'td', pathNodeType: 'object', pathParentNodeType: 'undefined', pathChildIndex: '', pathChildCount: '' },
				{ text: 'x|9', nodeName: 'th', pathNodeType: 'object', pathParentNodeType: 'undefined', pathChildIndex: '', pathChildCount: '' },
			]);
			assert.deepEqual(walked, noWalk);
		});
	});
});
