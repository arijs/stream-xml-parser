import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser, TreeBuilder, elementDefault, htmlVoidTagMap } from '../../src/index.mjs';

function buildTree(xml, opts) {
	const el = opts && opts.element ? opts.element : elementDefault();
	const treeEvents = [];
	const tb = new TreeBuilder({
		element: el,
		tagVoidMap: htmlVoidTagMap,
		event: ev => treeEvents.push(ev.name),
		...opts,
	});
	const xp = new XMLParser(tb.parserEvent.bind(tb));
	xp.end(xml);
	return {
		tree: el.childrenGet(tb.root.tag),
		errors: tb.errors,
		treeEvents,
		el,
		tb,
	};
}

describe('TreeBuilder', () => {
	describe('basic tree construction', () => {
		it('builds tree from simple element', () => {
			const { tree, el } = buildTree('<div></div>');
			assert.equal(tree.length, 1);
			assert.equal(el.nameGet(tree[0]), 'div');
		});

		it('builds nested tree', () => {
			const { tree, el } = buildTree('<ul><li>one</li><li>two</li></ul>');
			assert.equal(tree.length, 1);
			const ul = tree[0];
			assert.equal(el.nameGet(ul), 'ul');
			assert.equal(el.childCount(ul), 2);
			assert.equal(el.nameGet(el.childIndexGet(ul, 0)), 'li');
		});

		it('captures text content', () => {
			const { tree, el } = buildTree('<p>hello world</p>');
			const p = tree[0];
			const textChild = el.childrenGet(p).find(c => el.isText(c));
			assert.ok(textChild);
			assert.equal(el.textValueGet(textChild), 'hello world');
		});

		it('captures attributes', () => {
			const { tree, el } = buildTree('<a href="/path" class="link">text</a>');
			const a = tree[0];
			const attrs = [];
			el.attrsEach(a, (name, value) => { attrs.push({ name, value }); });
			assert.equal(attrs.length, 2);
			assert.equal(attrs[0].name, 'href');
			assert.equal(attrs[0].value, '/path');
		});

		it('builds multiple top-level elements', () => {
			const { tree, el } = buildTree('<a>1</a><b>2</b><c>3</c>');
			assert.equal(tree.length, 3);
			assert.equal(el.nameGet(tree[0]), 'a');
			assert.equal(el.nameGet(tree[1]), 'b');
			assert.equal(el.nameGet(tree[2]), 'c');
		});
	});

	describe('self-closing tags', () => {
		it('self-closing XML tag has no children', () => {
			const { tree, el } = buildTree('<img src="x.png" />', { tagVoidMap: {} });
			const img = tree[0];
			assert.equal(el.nameGet(img), 'img');
			assert.equal(el.childCount(img), 0);
		});

		it('void HTML tag (br) is treated as self-closing', () => {
			const { tree, el } = buildTree('<div><br><p>text</p></div>');
			const div = tree[0];
			const childNames = el.childrenGet(div).map(c => el.nameGet(c));
			assert.ok(childNames.includes('br'));
			assert.ok(childNames.includes('p'));
			// br and p should be siblings, not nested
			assert.equal(childNames.indexOf('p'), childNames.indexOf('br') + 1);
		});
	});

	describe('special nodes', () => {
		it('builds comment nodes', () => {
			const { tree, el } = buildTree('<div><!-- a comment --></div>');
			const div = tree[0];
			const comment = el.childrenGet(div).find(c => el.isComment(c));
			assert.ok(comment);
			assert.equal(el.textValueGet(comment), ' a comment ');
		});

		it('builds instruction nodes', () => {
			const { tree, el } = buildTree('<?xml version="1.0"?><root></root>');
			const instr = tree.find(c => el.isInstruction(c));
			assert.ok(instr);
			assert.equal(el.textValueGet(instr), 'xml version="1.0"?');
		});

		it('builds declaration nodes', () => {
			const { tree, el } = buildTree('<!DOCTYPE html><html></html>');
			const decl = tree.find(c => el.isDeclaration(c));
			assert.ok(decl);
		});
	});

	describe('error handling', () => {
		it('reports error (code 103) for close tag without matching open', () => {
			const { errors } = buildTree('<div></span></div>');
			assert.ok(errors.length > 0);
			const err103 = errors.find(e => e.code === 103);
			assert.ok(err103);
		});

		it('fires unopenedTag tree event for unmatched close tag', () => {
			const { treeEvents } = buildTree('<div></span></div>');
			assert.ok(treeEvents.includes('unopenedTag'));
		});

		it('no errors for well-formed XML', () => {
			const { errors } = buildTree('<root><child></child></root>', { tagVoidMap: {} });
			assert.equal(errors.length, 0);
		});

		it('does not crash on completely broken HTML', () => {
			assert.doesNotThrow(() => {
				buildTree('</div></div><a>');
			});
		});
	});

	describe('tree events', () => {
		it('fires tagOpenStart and tagOpenEnd for open tag', () => {
			const { treeEvents } = buildTree('<div></div>');
			assert.ok(treeEvents.includes('tagOpenStart'));
			assert.ok(treeEvents.includes('tagOpenEnd'));
		});

		it('fires tagCloseStart and tagCloseEnd for close tag', () => {
			const { treeEvents } = buildTree('<div></div>');
			assert.ok(treeEvents.includes('tagCloseStart'));
			assert.ok(treeEvents.includes('tagCloseEnd'));
		});

		it('fires text event for text content', () => {
			const { treeEvents } = buildTree('<p>hello</p>');
			assert.ok(treeEvents.includes('text'));
		});

		it('fires endStream event at end', () => {
			const { treeEvents } = buildTree('<p></p>');
			assert.ok(treeEvents.includes('endStream'));
		});

		it('fires tagCommentStart and tagCommentEnd for comments', () => {
			const { treeEvents } = buildTree('<!-- x -->');
			assert.ok(treeEvents.includes('tagCommentStart'));
			assert.ok(treeEvents.includes('tagCommentEnd'));
		});
	});

	describe('custom element adapter', () => {
		it('uses provided element adapter', () => {
			const customEl = elementDefault({ keyName: 'tag', keyChildren: 'kids' });
			const { tree } = buildTree('<div></div>', { element: customEl });
			assert.equal(tree[0].tag, 'div');
			assert.ok(Array.isArray(tree[0].kids));
		});
	});

	describe('constructor options', () => {
		it('accepts function as event option when element is set in opts', () => {
			const events = [];
			const el = elementDefault();
			const tb = new TreeBuilder({ event: ev => { events.push(ev.name); }, element: el });
			assert.ok(tb instanceof TreeBuilder);
		});

		it('root is set after construction', () => {
			const { tb } = buildTree('<a></a>');
			assert.ok(tb.root);
			assert.ok(tb.root.tag);
		});

		it('errors array starts empty', () => {
			const el = elementDefault();
			const tb = new TreeBuilder({ element: el });
			assert.deepEqual(tb.errors, []);
		});
	});
});
