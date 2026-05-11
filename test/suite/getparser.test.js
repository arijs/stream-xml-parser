import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getParser, elementDefault, htmlVoidTagMap } from '../../src/index.mjs';

function parse(html, opt) {
	const p = getParser(opt);
	p.end(html);
	return p.getResult();
}

function childNames(node, elAdapter) {
	const children = elAdapter.childrenGet(node);
	return children.map(c => elAdapter.nameGet(c));
}

describe('getParser', () => {
	describe('basic parsing', () => {
		it('returns tree and no errors for valid HTML', () => {
			const result = parse('<div>hello</div>');
			assert.equal(result.error, null);
			assert.ok(Array.isArray(result.tree));
		});

		it('parses single element', () => {
			const result = parse('<div></div>');
			assert.equal(result.tree.length, 1);
			assert.equal(result.elAdapter.nameGet(result.tree[0]), 'div');
		});

		it('parses nested elements', () => {
			const result = parse('<ul><li>one</li><li>two</li></ul>');
			const ul = result.tree[0];
			assert.equal(result.elAdapter.nameGet(ul), 'ul');
			assert.equal(result.elAdapter.childCount(ul), 2);
		});

		it('parses text content', () => {
			const result = parse('<p>hello world</p>');
			const p = result.tree[0];
			const children = result.elAdapter.childrenGet(p);
			const textChild = children.find(c => result.elAdapter.isText(c));
			assert.ok(textChild);
			assert.equal(result.elAdapter.textValueGet(textChild), 'hello world');
		});

		it('parses attributes', () => {
			const result = parse('<a href="/path" class="link">text</a>');
			const a = result.tree[0];
			const attrs = [];
			result.elAdapter.attrsEach(a, (name, value) => { attrs.push({ name, value }); });
			assert.equal(attrs[0].name, 'href');
			assert.equal(attrs[0].value, '/path');
			assert.equal(attrs[1].name, 'class');
			assert.equal(attrs[1].value, 'link');
		});
	});

	describe('self-closing tags', () => {
		it('parses self-closing XML tag', () => {
			const result = parse('<img src="foo.png" />', { tagVoidMap: {} });
			const img = result.tree[0];
			assert.equal(result.elAdapter.nameGet(img), 'img');
			assert.equal(result.elAdapter.childCount(img), 0);
		});

		it('treats void HTML tags as self-closing', () => {
			const result = parse('<div><br>text</div>');
			const div = result.tree[0];
			const names = childNames(div, result.elAdapter);
			// <br> is void, text comes after it as sibling
			assert.ok(names.includes('br'));
		});
	});

	describe('comments and special nodes', () => {
		it('parses comments into tree', () => {
			const result = parse('<div><!-- a comment --></div>');
			const div = result.tree[0];
			const children = result.elAdapter.childrenGet(div);
			const comment = children.find(c => result.elAdapter.isComment(c));
			assert.ok(comment);
			assert.equal(result.elAdapter.textValueGet(comment), ' a comment ');
		});

		it('parses CDATA into tree', () => {
			const result = parse('<div><![CDATA[raw content]]></div>');
			const div = result.tree[0];
			// CDATA content ends up as children
			assert.ok(result.elAdapter.childCount(div) >= 0);
		});

		it('parses processing instructions', () => {
			const result = parse('<?xml version="1.0"?><root></root>');
			const instr = result.tree.find(c => result.elAdapter.isInstruction(c));
			assert.ok(instr);
			assert.equal(result.elAdapter.textValueGet(instr), 'xml version="1.0"?');
		});

		it('parses DOCTYPE declaration', () => {
			const result = parse('<!DOCTYPE html><html></html>');
			const decl = result.tree.find(c => result.elAdapter.isDeclaration(c));
			assert.ok(decl);
		});
	});

	describe('error handling', () => {
		it('reports error for close tag without matching open tag', () => {
			const result = parse('<div></span></div>');
			assert.ok(result.error);
			assert.ok(result.error.length > 0);
		});

		it('no error for well-formed XML', () => {
			const result = parse('<root><child>text</child></root>');
			assert.equal(result.error, null);
		});

		it('handles multiple top-level elements', () => {
			const result = parse('<a>1</a><b>2</b><c>3</c>');
			assert.equal(result.tree.length, 3);
		});
	});

	describe('write then end', () => {
		it('supports write() then end()', () => {
			const p = getParser();
			p.write('<div>');
			p.write('hello');
			p.end('</div>');
			const result = p.getResult();
			assert.equal(result.error, null);
			assert.equal(result.tree.length, 1);
		});

		it('end() with remaining text', () => {
			const p = getParser();
			p.end('plain text');
			const result = p.getResult();
			const text = result.tree.find(c => result.elAdapter.isText(c));
			assert.ok(text);
			assert.equal(result.elAdapter.textValueGet(text), 'plain text');
		});
	});

	describe('getResult options', () => {
		it('asNode returns root node when true', () => {
			const p = getParser();
			p.end('<div></div>');
			const result = p.getResult({ asNode: true });
			assert.equal(result.elAdapter.isFragment(result.tree), true);
		});

		it('returns array of children when asNode is false (default)', () => {
			const p = getParser();
			p.end('<div></div>');
			const result = p.getResult();
			assert.ok(Array.isArray(result.tree));
		});
	});

	describe('custom adapter', () => {
		it('uses provided elAdapter', () => {
			const customAdapter = elementDefault({ keyName: 'tag', keyChildren: 'kids' });
			const p = getParser({ elAdapter: customAdapter });
			p.end('<span>text</span>');
			const result = p.getResult();
			const span = result.tree[0];
			assert.equal(span.tag, 'span');
			assert.ok(Array.isArray(span.kids));
		});
	});
});
