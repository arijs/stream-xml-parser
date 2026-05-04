'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getParser, Printer, elementDefault, htmlVoidTagMap } = require('../..');

function parseAndPrint(html, printerOpts) {
	const p = getParser();
	p.end(html);
	const result = p.getResult();
	const printer = new Printer({ elAdapter: result.elAdapter, ...printerOpts });
	return printer.print(result.tree, 0);
}

function makeTree(el, build) {
	const root = el.initRoot();
	build(root, el);
	return el.childrenGet(root);
}

describe('Printer', () => {
	describe('basic output', () => {
		it('prints a simple element', () => {
			const out = parseAndPrint('<div></div>');
			assert.ok(out.includes('<div>'));
			assert.ok(out.includes('</div>'));
		});

		it('prints attributes', () => {
			const out = parseAndPrint('<a href="/path" class="link"></a>');
			assert.ok(out.includes('href="/path"'));
			assert.ok(out.includes('class="link"'));
		});

		it('prints text content', () => {
			const out = parseAndPrint('<p>hello world</p>');
			assert.ok(out.includes('hello world'));
		});

		it('prints nested elements', () => {
			const out = parseAndPrint('<ul><li>item</li></ul>');
			assert.ok(out.includes('<ul>'));
			assert.ok(out.includes('<li>'));
			assert.ok(out.includes('item'));
			assert.ok(out.includes('</li>'));
			assert.ok(out.includes('</ul>'));
		});
	});

	describe('void tags', () => {
		it('does not print closing tag for void elements', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				el.childElement(root, el.initName('br'));
			});
			const printer = new Printer({ elAdapter: el, tagVoidMap: htmlVoidTagMap });
			const out = printer.print(tree, 0);
			assert.ok(!out.includes('</br>'), 'void tag should not have closing tag');
			assert.ok(out.includes('<br'), 'void tag should have open tag');
		});

		it('prints closing tag for non-void elements', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				el.childElement(root, el.initName('div'));
			});
			const printer = new Printer({ elAdapter: el, tagVoidMap: htmlVoidTagMap });
			const out = printer.print(tree, 0);
			assert.ok(out.includes('</div>'));
		});
	});

	describe('special nodes', () => {
		it('prints comments', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				el.childElement(root, el.initComment(' a comment '));
			});
			const printer = new Printer({ elAdapter: el });
			const out = printer.print(tree, 0);
			assert.ok(out.includes('<!-- a comment -->'));
		});

		it('prints declarations', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				el.childElement(root, el.initDeclaration('DOCTYPE html'));
			});
			const printer = new Printer({ elAdapter: el });
			const out = printer.print(tree, 0);
			assert.ok(out.includes('<!DOCTYPE html>'));
		});

		it('prints processing instructions', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				el.childElement(root, el.initInstruction('xml version="1.0"'));
			});
			const printer = new Printer({ elAdapter: el });
			const out = printer.print(tree, 0);
			assert.ok(out.includes('<?xml version="1.0">'));
		});
	});

	describe('indentation', () => {
		it('uses tab indentation by default', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				const div = el.initName('div');
				el.childText(div, 'hello');
				el.childElement(root, div);
			});
			const printer = new Printer({ elAdapter: el });
			const out = printer.print(tree, 0);
			assert.ok(out.includes('\t'));
		});

		it('uses space indentation when indent is a number', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				const div = el.initName('div');
				el.childText(div, 'hello');
				el.childElement(root, div);
			});
			const printer = new Printer({ elAdapter: el, indent: 2 });
			const out = printer.print(tree, 0);
			assert.ok(out.includes('  '));
		});

		it('uses custom indent string', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				const div = el.initName('div');
				el.childText(div, 'hello');
				el.childElement(root, div);
			});
			const printer = new Printer({ elAdapter: el, indent: '--' });
			const out = printer.print(tree, 0);
			assert.ok(out.includes('--'));
		});
	});

	describe('noFormat mode', () => {
		it('does not add newlines in noFormat mode', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				const div = el.initName('div');
				el.childText(div, 'hello');
				el.childElement(root, div);
			});
			const printer = new Printer({ elAdapter: el, noFormat: true });
			const out = printer.print(tree, 0);
			assert.ok(!out.includes('\n'));
		});

		it('does not add indentation in noFormat mode', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				const div = el.initName('div');
				el.childText(div, 'hello');
				el.childElement(root, div);
			});
			const printer = new Printer({ elAdapter: el, noFormat: true });
			const out = printer.print(tree, 0);
			assert.ok(!out.includes('\t'));
		});

		it('prints raw text in noFormat mode', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				el.childText(root, '   spaced text   ');
			});
			const printer = new Printer({ elAdapter: el, noFormat: true });
			const out = printer.print(tree, 0);
			assert.equal(out, '   spaced text   ');
		});
	});

	describe('text trimming', () => {
		it('trims surrounding whitespace from text in formatted mode', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				const div = el.initName('div');
				el.childText(div, '\n  hello  \n');
				el.childElement(root, div);
			});
			const printer = new Printer({ elAdapter: el });
			const out = printer.print(tree, 0);
			assert.ok(out.includes('hello'), 'should include text');
			assert.ok(!out.match(/^\s+hello\s+$/m) || out.includes('\thello'), 'text should be trimmed');
		});
	});

	describe('encode functions', () => {
		it('encodeAttrValue is applied to attribute values', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				const a = el.initName('a');
				el.attrsAdd(a, { name: 'href', value: 'a&b' });
				el.childElement(root, a);
			});
			const printer = new Printer({
				elAdapter: el,
				encodeAttrValue: (v) => v.replace(/&/g, '&amp;'),
			});
			const out = printer.print(tree, 0);
			assert.ok(out.includes('&amp;'));
		});

		it('encodeTagName is applied to tag names', () => {
			const el = elementDefault();
			const tree = makeTree(el, (root) => {
				el.childElement(root, el.initName('div'));
			});
			const printer = new Printer({
				elAdapter: el,
				encodeTagName: (name) => name.toUpperCase(),
			});
			const out = printer.print(tree, 0);
			assert.ok(out.includes('<DIV>'));
			assert.ok(out.includes('</DIV>'));
		});
	});

	describe('printTagOpen / printTagClose', () => {
		it('printTagOpen produces correct output', () => {
			const el = elementDefault();
			const node = el.initName('div');
			el.attrsAdd(node, { name: 'id', value: 'main' });
			const printer = new Printer({ elAdapter: el });
			const out = printer.printTagOpen(node);
			assert.equal(out, '<div id="main">');
		});

		it('printTagClose produces correct output', () => {
			const el = elementDefault();
			const node = el.initName('section');
			const printer = new Printer({ elAdapter: el });
			const out = printer.printTagClose(node);
			assert.equal(out, '</section>');
		});

		it('printTagOpen with selfClose', () => {
			const el = elementDefault();
			const node = el.initName('br');
			const printer = new Printer({ elAdapter: el });
			const out = printer.printTagOpen(node, true);
			assert.ok(out.includes(' /'));
		});
	});

	describe('round-trip', () => {
		it('parses and re-prints simple XML accurately', () => {
			const xml = '<root><child attr="val">text</child></root>';
			const p = getParser({ tagVoidMap: {} });
			p.end(xml);
			const result = p.getResult();
			const printer = new Printer({ elAdapter: result.elAdapter, noFormat: true });
			const out = printer.print(result.tree, 0);
			assert.ok(out.includes('<root>'));
			assert.ok(out.includes('<child attr="val">'));
			assert.ok(out.includes('text'));
			assert.ok(out.includes('</child>'));
			assert.ok(out.includes('</root>'));
		});
	});
});
