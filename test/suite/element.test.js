'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { elementDefault } = require('../..');

describe('elementDefault', () => {
	describe('node creation', () => {
		it('initRoot creates a document-fragment node', () => {
			const el = elementDefault();
			const root = el.initRoot();
			assert.equal(el.nameGet(root), '#document-fragment');
			assert.equal(el.isFragment(root), true);
			assert.equal(el.isText(root), false);
		});

		it('initName creates an element node', () => {
			const el = elementDefault();
			const node = el.initName('div');
			assert.equal(el.nameGet(node), 'div');
			assert.equal(el.isText(node), false);
			assert.deepEqual(el.childrenGet(node), []);
		});

		it('textNode creates a text node', () => {
			const el = elementDefault();
			const text = el.textNode('hello');
			assert.equal(el.isText(text), true);
			assert.equal(el.textValueGet(text), 'hello');
		});

		it('initComment creates a comment node', () => {
			const el = elementDefault();
			const node = el.initComment('my comment');
			assert.equal(el.isComment(node), true);
			assert.equal(el.textValueGet(node), 'my comment');
		});

		it('initDeclaration creates a declaration node', () => {
			const el = elementDefault();
			const node = el.initDeclaration('DOCTYPE html');
			assert.equal(el.isDeclaration(node), true);
			assert.equal(el.textValueGet(node), 'DOCTYPE html');
		});

		it('initInstruction creates an instruction node', () => {
			const el = elementDefault();
			const node = el.initInstruction('xml version="1.0"');
			assert.equal(el.isInstruction(node), true);
			assert.equal(el.textValueGet(node), 'xml version="1.0"');
		});

		it('initComment with no argument uses empty string', () => {
			const el = elementDefault();
			const node = el.initComment();
			assert.equal(el.textValueGet(node), '');
		});
	});

	describe('attributes', () => {
		it('attrsAdd and attrsEach work together', () => {
			const el = elementDefault();
			const node = el.initName('a');
			el.attrsAdd(node, { name: 'href', value: '/path' });
			el.attrsAdd(node, { name: 'title', value: 'Link' });
			const attrs = [];
			el.attrsEach(node, (name, value) => { attrs.push({ name, value }); });
			assert.deepEqual(attrs, [
				{ name: 'href', value: '/path' },
				{ name: 'title', value: 'Link' },
			]);
		});

		it('attrsEach _remove flag removes attribute', () => {
			const el = elementDefault();
			const node = el.initName('span');
			el.attrsAdd(node, { name: 'class', value: 'foo' });
			el.attrsAdd(node, { name: 'id', value: 'bar' });
			el.attrsEach(node, function(name) {
				if (name === 'class') return this._remove;
			});
			const attrs = [];
			el.attrsEach(node, (name, value) => attrs.push(name));
			assert.deepEqual(attrs, ['id']);
		});

		it('attrsEach _break flag stops iteration', () => {
			const el = elementDefault();
			const node = el.initName('span');
			el.attrsAdd(node, { name: 'a', value: '1' });
			el.attrsAdd(node, { name: 'b', value: '2' });
			el.attrsAdd(node, { name: 'c', value: '3' });
			let count = 0;
			el.attrsEach(node, function(name) {
				count++;
				if (name === 'b') return this._break;
			});
			assert.equal(count, 2);
		});
	});

	describe('children', () => {
		it('childElement appends element child', () => {
			const el = elementDefault();
			const parent = el.initName('ul');
			const child = el.initName('li');
			el.childElement(parent, child);
			assert.equal(el.childCount(parent), 1);
			assert.equal(el.childIndexGet(parent, 0), child);
		});

		it('childText appends text child', () => {
			const el = elementDefault();
			const parent = el.initName('p');
			el.childText(parent, 'hello');
			assert.equal(el.childCount(parent), 1);
			const child = el.childIndexGet(parent, 0);
			assert.equal(el.isText(child), true);
			assert.equal(el.textValueGet(child), 'hello');
		});

		it('childCount returns correct count', () => {
			const el = elementDefault();
			const parent = el.initName('div');
			assert.equal(el.childCount(parent), 0);
			el.childText(parent, 'a');
			assert.equal(el.childCount(parent), 1);
			el.childText(parent, 'b');
			assert.equal(el.childCount(parent), 2);
		});

		it('childSplice removes children', () => {
			const el = elementDefault();
			const parent = el.initName('div');
			el.childText(parent, 'a');
			el.childText(parent, 'b');
			el.childText(parent, 'c');
			el.childSplice(parent, 1, 1);
			assert.equal(el.childCount(parent), 2);
			assert.equal(el.textValueGet(el.childIndexGet(parent, 0)), 'a');
			assert.equal(el.textValueGet(el.childIndexGet(parent, 1)), 'c');
		});

		it('childSplice inserts children', () => {
			const el = elementDefault();
			const parent = el.initName('div');
			el.childText(parent, 'a');
			el.childText(parent, 'c');
			const newNode = el.textNode('b');
			el.childSplice(parent, 1, 0, [newNode]);
			assert.equal(el.childCount(parent), 3);
			assert.equal(el.textValueGet(el.childIndexGet(parent, 1)), 'b');
		});

		it('childrenGet returns the children array', () => {
			const el = elementDefault();
			const parent = el.initName('div');
			const child = el.initName('span');
			el.childElement(parent, child);
			const children = el.childrenGet(parent);
			assert.ok(Array.isArray(children));
			assert.equal(children.length, 1);
			assert.equal(children[0], child);
		});

		it('childrenSet replaces children array', () => {
			const el = elementDefault();
			const parent = el.initName('div');
			el.childText(parent, 'old');
			const newChild = el.textNode('new');
			el.childrenSet(parent, [newChild]);
			assert.equal(el.childCount(parent), 1);
			assert.equal(el.textValueGet(el.childIndexGet(parent, 0)), 'new');
		});
	});

	describe('type predicates', () => {
		it('isText returns true for text node', () => {
			const el = elementDefault();
			assert.equal(el.isText(el.textNode('hello')), true);
			assert.equal(el.isText(el.initName('div')), false);
		});

		it('isFragment returns true for root node', () => {
			const el = elementDefault();
			assert.equal(el.isFragment(el.initRoot()), true);
			assert.equal(el.isFragment(el.initName('div')), false);
		});

		it('isComment returns true for comment node', () => {
			const el = elementDefault();
			assert.equal(el.isComment(el.initComment('x')), true);
			assert.equal(el.isComment(el.textNode('x')), false);
		});

		it('isDeclaration returns true for declaration node', () => {
			const el = elementDefault();
			assert.equal(el.isDeclaration(el.initDeclaration('DOCTYPE')), true);
			assert.equal(el.isDeclaration(el.initName('div')), false);
		});

		it('isInstruction returns true for instruction node', () => {
			const el = elementDefault();
			assert.equal(el.isInstruction(el.initInstruction('xml')), true);
			assert.equal(el.isInstruction(el.initName('div')), false);
		});
	});

	describe('custom key names', () => {
		it('supports custom keyName', () => {
			const el = elementDefault({ keyName: 'tag' });
			const node = el.initName('span');
			assert.equal(node.tag, 'span');
			assert.equal(el.nameGet(node), 'span');
		});

		it('supports custom keyChildren', () => {
			const el = elementDefault({ keyChildren: 'kids' });
			const parent = el.initName('div');
			const child = el.initName('p');
			el.childElement(parent, child);
			assert.ok(Array.isArray(parent.kids));
			assert.equal(parent.kids[0], child);
		});
	});
});
