import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getParser, treeRender, elementDefault } from '../../src/index.mjs';

function parse(xml, opts) {
	const p = getParser({ tagVoidMap: {}, ...opts });
	p.end(xml);
	return p.getResult();
}

describe('treeRender', () => {
	describe('treeRenderPlugin', () => {
		it('identity plugin returns unchanged tree', () => {
			const { tree, elAdapter: el } = parse('<div><span>hello</span></div>');
			const result = treeRender.treeRenderPlugin(tree, el, {}, node => node);
			assert.ok(Array.isArray(result));
			assert.equal(el.nameGet(result[0]), 'div');
		});

		it('plugin can replace a node', () => {
			const { tree, elAdapter: el } = parse('<div></div>');
			const result = treeRender.treeRenderPlugin(tree, el, {}, (node) => {
				if (el.nameGet(node) === 'div') {
					const newNode = el.initName('section');
					return newNode;
				}
				return node;
			});
			assert.equal(el.nameGet(result[0]), 'section');
		});

		it('plugin can expand a node into multiple nodes', () => {
			const { tree, elAdapter: el } = parse('<x></x>');
			const result = treeRender.treeRenderPlugin(tree, el, {}, (node) => {
				const a = el.initName('a');
				const b = el.initName('b');
				return [a, b];
			});
			assert.equal(result.length, 2);
			assert.equal(el.nameGet(result[0]), 'a');
			assert.equal(el.nameGet(result[1]), 'b');
		});

		it('works with tree as a node (isChildren=false)', () => {
			const { tree, elAdapter: el } = parse('<div><span></span></div>');
			const root = el.initRoot();
			el.childrenSet(root, tree);
			const result = treeRender.treeRenderPlugin(root, el, {}, node => node);
			assert.ok(!Array.isArray(result));
		});

		it('provides breadcrumb context to plugin', () => {
			const { tree, elAdapter: el } = parse('<div><span></span></div>');
			const ctx = {};
			let capturedBreadcrumb = null;
			treeRender.treeRenderPlugin(tree, el, ctx, (node, adapter, context) => {
				capturedBreadcrumb = context.getBreadcrumb && context.getBreadcrumb();
				return node;
			});
			assert.ok(capturedBreadcrumb !== null);
		});
	});

	describe('treeRender (multiple plugins)', () => {
		it('applies multiple plugins in sequence', () => {
			const { tree, elAdapter: el } = parse('<div></div>');
			const log = [];
			const result = treeRender.treeRender(tree, el, {}, [
				(node) => { log.push('plugin1'); return node; },
				(node) => { log.push('plugin2'); return node; },
			]);
			assert.ok(log.includes('plugin1'));
			assert.ok(log.includes('plugin2'));
			assert.equal(el.nameGet(result[0]), 'div');
		});

		it('supports plugin as object with targetAdapter', () => {
			const { tree, elAdapter: sourceEl } = parse('<div><span>text</span></div>');
			const targetEl = elementDefault();
			const plugin = treeRender.adapterPluginConvertElement(targetEl);
			const result = treeRender.treeRenderPlugin(tree, sourceEl, {}, plugin);
			assert.equal(result.length, 1);
			assert.equal(targetEl.nameGet(result[0]), 'div');
		});
	});

	describe('adapterPluginConvertElement', () => {
		it('converts tree to target adapter format', () => {
			const { tree, elAdapter: sourceEl } = parse('<ul><li>one</li><li>two</li></ul>');
			const targetEl = elementDefault();
			const plugin = treeRender.adapterPluginConvertElement(targetEl);
			const result = treeRender.treeRenderPlugin(tree, sourceEl, {}, plugin);

			assert.equal(result.length, 1);
			const ul = result[0];
			assert.equal(targetEl.nameGet(ul), 'ul');
			assert.equal(targetEl.childCount(ul), 2);
			assert.equal(targetEl.nameGet(targetEl.childIndexGet(ul, 0)), 'li');
		});

		it('converts text nodes to target adapter text nodes', () => {
			const { tree, elAdapter: sourceEl } = parse('<p>hello world</p>');
			const targetEl = elementDefault();
			const plugin = treeRender.adapterPluginConvertElement(targetEl);
			const result = treeRender.treeRenderPlugin(tree, sourceEl, {}, plugin);
			const p = result[0];
			const textChild = targetEl.childIndexGet(p, 0);
			assert.equal(targetEl.isText(textChild), true);
			assert.equal(targetEl.textValueGet(textChild), 'hello world');
		});

		it('converts attributes to target adapter', () => {
			const { tree, elAdapter: sourceEl } = parse('<a href="/path" class="link"></a>');
			const targetEl = elementDefault();
			const plugin = treeRender.adapterPluginConvertElement(targetEl);
			const result = treeRender.treeRenderPlugin(tree, sourceEl, {}, plugin);
			const a = result[0];
			const attrs = [];
			targetEl.attrsEach(a, (name, value) => { attrs.push({ name, value }); });
			assert.equal(attrs.length, 2);
			assert.equal(attrs[0].name, 'href');
			assert.equal(attrs[0].value, '/path');
		});

		it('deeply converts nested nodes', () => {
			const { tree, elAdapter: sourceEl } = parse('<div><p><span>deep</span></p></div>');
			const targetEl = elementDefault();
			const plugin = treeRender.adapterPluginConvertElement(targetEl);
			const result = treeRender.treeRenderPlugin(tree, sourceEl, {}, plugin);
			const div = result[0];
			const p = targetEl.childIndexGet(div, 0);
			const span = targetEl.childIndexGet(p, 0);
			assert.equal(targetEl.nameGet(span), 'span');
			const textNode = targetEl.childIndexGet(span, 0);
			assert.equal(targetEl.textValueGet(textNode), 'deep');
		});
	});

	describe('listToNode', () => {
		it('wraps array in a root node', () => {
			const el = elementDefault();
			const a = el.initName('a');
			const b = el.initName('b');
			const root = treeRender.listToNode([a, b], el);
			assert.equal(el.isFragment(root), true);
			assert.equal(el.childCount(root), 2);
			assert.equal(el.childIndexGet(root, 0), a);
			assert.equal(el.childIndexGet(root, 1), b);
		});
	});

	describe('pluginAttr', () => {
		it('iterates over attributes with handler', () => {
			const el = elementDefault();
			const node = el.initName('div');
			el.attrsAdd(node, { name: 'class', value: 'foo' });
			el.attrsAdd(node, { name: 'id', value: 'bar' });
			const collected = [];
			treeRender.pluginAttr(node, el, {}, (name, value) => collected.push({ name, value }));
			assert.equal(collected.length, 2);
			assert.equal(collected[0].name, 'class');
			assert.equal(collected[1].name, 'id');
		});

		it('uses resultNode function if provided', () => {
			const el = elementDefault();
			const node = el.initName('div');
			const newNode = el.initName('span');
			const result = treeRender.pluginAttr(node, el, {}, () => {}, () => newNode);
			assert.equal(result, newNode);
		});
	});
});
