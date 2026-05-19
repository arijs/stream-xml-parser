import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getParser, treeWalk, getFullTreePath } from '../../src/index.mjs';

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
});
