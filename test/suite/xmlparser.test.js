import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser } from '../../src/index.mjs';

function collectEvents(xml) {
	const events = [];
	const xp = new XMLParser(ev => events.push({
		name: ev.name,
		tag: ev.tag ? { ...ev.tag } : null,
		attr: ev.attr ? { ...ev.attr } : null,
		text: ev.text,
		id: ev.id,
	}));
	xp.end(xml);
	return events;
}

function eventNames(xml) {
	return collectEvents(xml).map(e => e.name);
}

function tagsOnly(events) {
	return events.filter(e => e.name === 'tagName' || e.name === 'endTag');
}

describe('XMLParser', () => {
	describe('plain text', () => {
		it('emits text event for plain text', () => {
			const events = collectEvents('hello world');
			const textEv = events.find(e => e.name === 'text');
			assert.ok(textEv, 'text event should be emitted');
			assert.equal(textEv.text, 'hello world');
		});

		it('emits endStream at the end', () => {
			const events = collectEvents('foo');
			assert.equal(events[events.length - 1].name, 'endStream');
		});

		it('emits no text event for empty input', () => {
			const events = collectEvents('');
			assert.ok(!events.find(e => e.name === 'text'));
			assert.equal(events[0].name, 'endStream');
		});

		it('accumulates text before a tag', () => {
			const events = collectEvents('before<tag>');
			const textEv = events.find(e => e.name === 'text');
			assert.ok(textEv);
			assert.equal(textEv.text, 'before');
		});
	});

	describe('open and close tags', () => {
		it('emits startTag, tagName, endTag for an open tag', () => {
			const events = collectEvents('<div>');
			assert.equal(events[0].name, 'startTag');
			assert.equal(events[1].name, 'tagName');
			assert.equal(events[1].tag.name, 'div');
			assert.equal(events[2].name, 'endTag');
		});

		it('sets close flag on closing tag', () => {
			const events = collectEvents('</div>');
			const tagName = events.find(e => e.name === 'tagName');
			assert.ok(tagName);
			assert.equal(tagName.tag.name, 'div');
			assert.equal(tagName.tag.close, true);
		});

		it('sets selfClose flag on self-closing tag', () => {
			const events = collectEvents('<br />');
			const endTag = events.find(e => e.name === 'endTag');
			assert.ok(endTag);
			assert.equal(endTag.tag.selfClose, true);
		});

		it('parses multiple tags correctly', () => {
			const events = collectEvents('<a><b></b></a>');
			const tagNames = events
				.filter(e => e.name === 'tagName')
				.map(e => ({ name: e.tag.name, close: !!e.tag.close }));
			assert.deepEqual(tagNames, [
				{ name: 'a', close: false },
				{ name: 'b', close: false },
				{ name: 'b', close: true },
				{ name: 'a', close: true },
			]);
		});

		it('handles empty tag <>', () => {
			const events = collectEvents('<>');
			const endTag = events.find(e => e.name === 'endTag');
			assert.ok(endTag);
			assert.equal(endTag.tag.empty, true);
		});
	});

	describe('attributes', () => {
		it('emits tagAttribute for a double-quoted attribute', () => {
			const events = collectEvents('<div class="foo">');
			const attr = events.find(e => e.name === 'tagAttribute');
			assert.ok(attr);
			assert.equal(attr.attr.name, 'class');
			assert.equal(attr.attr.value, 'foo');
			assert.equal(attr.attr.quotes, '"');
		});

		it('emits tagAttribute for a single-quoted attribute', () => {
			const events = collectEvents("<div class='bar'>");
			const attr = events.find(e => e.name === 'tagAttribute');
			assert.ok(attr);
			assert.equal(attr.attr.value, 'bar');
			assert.equal(attr.attr.quotes, "'");
		});

		it('emits tagAttribute for raw (unquoted) attribute value', () => {
			const events = collectEvents('<div id=myid>');
			const attr = events.find(e => e.name === 'tagAttribute');
			assert.ok(attr);
			assert.equal(attr.attr.name, 'id');
			assert.equal(attr.attr.value, 'myid');
		});

		it('emits tagAttribute for boolean attribute (no value)', () => {
			const events = collectEvents('<input disabled>');
			const attr = events.find(e => e.name === 'tagAttribute');
			assert.ok(attr);
			assert.equal(attr.attr.name, 'disabled');
			assert.equal(attr.attr.value, null);
		});

		it('emits multiple tagAttribute events for multiple attributes', () => {
			const events = collectEvents('<a href="/path" title="link" target="_blank">');
			const attrs = events.filter(e => e.name === 'tagAttribute');
			assert.equal(attrs.length, 3);
			assert.equal(attrs[0].attr.name, 'href');
			assert.equal(attrs[0].attr.value, '/path');
			assert.equal(attrs[1].attr.name, 'title');
			assert.equal(attrs[1].attr.value, 'link');
			assert.equal(attrs[2].attr.name, 'target');
			assert.equal(attrs[2].attr.value, '_blank');
		});
	});

	describe('comments', () => {
		it('emits startComment and endComment', () => {
			const events = collectEvents('<!-- hello world -->');
			assert.ok(events.find(e => e.name === 'startComment'));
			const end = events.find(e => e.name === 'endComment');
			assert.ok(end);
			assert.equal(end.tag.textComment, ' hello world ');
		});

		it('handles comment with dashes inside', () => {
			const events = collectEvents('<!-- a-b--c -->');
			const end = events.find(e => e.name === 'endComment');
			assert.ok(end);
			assert.equal(end.tag.textComment, ' a-b--c ');
		});

		it('handles adjacent text and comment', () => {
			const evNames = eventNames('before<!-- comment -->after');
			assert.ok(evNames.includes('startComment'));
			assert.ok(evNames.includes('endComment'));
			const textEvents = collectEvents('before<!-- comment -->after')
				.filter(e => e.name === 'text').map(e => e.text);
			assert.ok(textEvents.includes('before'));
			assert.ok(textEvents.includes('after'));
		});
	});

	describe('CDATA sections', () => {
		it('emits startCdata and endCdata', () => {
			const events = collectEvents('<![CDATA[some data]]>');
			assert.ok(events.find(e => e.name === 'startCdata'));
			const end = events.find(e => e.name === 'endCdata');
			assert.ok(end);
			assert.equal(end.tag.textCdata, 'some data');
		});

		it('handles CDATA with special chars', () => {
			const events = collectEvents('<![CDATA[<div>foo & bar</div>]]>');
			const end = events.find(e => e.name === 'endCdata');
			assert.ok(end);
			assert.equal(end.tag.textCdata, '<div>foo & bar</div>');
		});
	});

	describe('processing instructions', () => {
		it('emits startInstruction and endInstruction', () => {
			const events = collectEvents('<?xml version="1.0"?>');
			assert.ok(events.find(e => e.name === 'startInstruction'));
			const end = events.find(e => e.name === 'endInstruction');
			assert.ok(end);
			assert.equal(end.tag.text, 'xml version="1.0"?');
		});
	});

	describe('declarations', () => {
		it('emits startDeclaration and endDeclaration for DOCTYPE', () => {
			const events = collectEvents('<!DOCTYPE html>');
			assert.ok(events.find(e => e.name === 'startDeclaration'));
			assert.ok(events.find(e => e.name === 'endDeclaration'));
		});

		it('captures declaration text', () => {
			const events = collectEvents('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0//EN">');
			const end = events.find(e => e.name === 'endDeclaration');
			assert.ok(end);
			assert.ok(end.tag.text.includes('DOCTYPE'));
		});
	});

	describe('streaming (multiple writes)', () => {
		it('handles tag split across chunks', () => {
			const events = [];
			const xp = new XMLParser(ev => events.push({ name: ev.name, tag: ev.tag }));
			xp.write('<di');
			xp.write('v>');
			xp.end();
			const tagName = events.find(e => e.name === 'tagName');
			assert.ok(tagName);
			assert.equal(tagName.tag.name, 'div');
		});

		it('handles text split across chunks', () => {
			const events = [];
			const xp = new XMLParser(ev => events.push({ name: ev.name, text: ev.text }));
			xp.write('hel');
			xp.write('lo');
			xp.end();
			const textEv = events.find(e => e.name === 'text');
			assert.ok(textEv);
			assert.equal(textEv.text, 'hello');
		});

		it('handles attribute value split across chunks', () => {
			const events = [];
			const xp = new XMLParser(ev => events.push({ name: ev.name, attr: ev.attr }));
			xp.write('<div class="fo');
			xp.write('o">');
			xp.end();
			const attrEv = events.find(e => e.name === 'tagAttribute');
			assert.ok(attrEv);
			assert.equal(attrEv.attr.value, 'foo');
		});

		it('handles comment split across chunks', () => {
			const events = [];
			const xp = new XMLParser(ev => events.push({ name: ev.name, tag: ev.tag }));
			xp.write('<!-- hel');
			xp.write('lo -->');
			xp.end();
			const endComment = events.find(e => e.name === 'endComment');
			assert.ok(endComment);
			assert.equal(endComment.tag.textComment, ' hello ');
		});
	});

	describe('decode functions', () => {
		it('decodeText transforms text', () => {
			const events = [];
			const xp = new XMLParser({
				event: ev => events.push({ name: ev.name, text: ev.text }),
				decodeText: (text) => text.toUpperCase(),
			});
			xp.end('<div>hello</div>');
			const textEv = events.find(e => e.name === 'text');
			assert.equal(textEv.text, 'HELLO');
		});

		it('decodeTagName transforms tag name', () => {
			const events = [];
			const xp = new XMLParser({
				event: ev => events.push({ name: ev.name, tag: ev.tag }),
				decodeTagName: (name) => name.toUpperCase(),
			});
			xp.end('<div>');
			const tagName = events.find(e => e.name === 'tagName');
			assert.equal(tagName.tag.name, 'DIV');
		});

		it('decodeAttrValue transforms attribute value', () => {
			const events = [];
			const xp = new XMLParser({
				event: ev => events.push({ name: ev.name, attr: ev.attr }),
				decodeAttrValue: (value) => value ? value.replace('&amp;', '&') : value,
			});
			xp.end('<a href="a&amp;b">');
			const attrEv = events.find(e => e.name === 'tagAttribute');
			assert.equal(attrEv.attr.value, 'a&b');
		});
	});

	describe('position tracking', () => {
		it('tracks line and column', () => {
			const positions = [];
			const xp = new XMLParser(ev => {
				if (ev.name === 'tagName') {
					positions.push({ line: ev.parser.line, column: ev.parser.column });
				}
			});
			xp.end('<a>\n<b>');
			assert.equal(positions.length, 2);
			assert.equal(positions[0].line, 0); // first tag on line 0
			assert.equal(positions[1].line, 1); // second tag on line 1
		});
	});
});
