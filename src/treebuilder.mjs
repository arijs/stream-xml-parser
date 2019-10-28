import * as elementDefault from './element/default';

var slice = Array.prototype.slice;

var events = {
	startTag: function(streamTag, parser, eventId) {
		this.treeEvent('tagInit', null, null, streamTag, parser, eventId);
	},
	tagName: function(streamTag, parser, eventId) {
		if (streamTag.close) {
			this.findAndCloseTag(streamTag, parser, eventId);
		} else {
			this.openTag(streamTag, parser, eventId);
		}
	},
	tagAttribute: function(streamAttr, streamTag, parser, eventId) {
		this.elementAttrs.add(this.currentScope.tag, streamAttr);
	},
	endTag: function(streamTag, parser, eventId) {
		var breadcrumb = this.currentScope;
		if (!streamTag.close) {
			this.treeEvent('tagOpenEnd', null, breadcrumb, streamTag, parser, eventId);
			this.path.push(breadcrumb);
			this.elementChildren.addElement(breadcrumb.parentScope.tag, breadcrumb.tag);
			// this.currentChildren.push(breadcrumb.tag);
			// this.currentChildren = breadcrumb.tag.children;
		}
		if (streamTag.selfClose) {
			this.findAndCloseTag(streamTag, parser, eventId);
		}
		if (streamTag.close || streamTag.selfClose) {
			var tagOpen = this.closeTagMatch;
			var breadcrumbClose = tagOpen.match;
			this.treeEvent('tagCloseEnd', null, breadcrumbClose, streamTag, parser, eventId);
			this.path = this.path.slice(0, tagOpen.index);
			this.currentScope = this.currentScope.parentScope;
			// this.currentTag = breadcrumbClose.parentTag;
			// this.currentChildren = breadcrumbClose.parentChildren;
			this.closeTagMatch = null;
		}
	},
	text: function(text) {
		this.elementChildren.addText(this.currentScope.tag, text);
	}
};

function parserState(parser, eventId) {
	return {
		chr: parser.c,
		pos: parser.pos,
		line: parser.line,
		column: parser.column,
		endPos: parser.endPos,
		endLine: parser.endLine,
		endColumn: parser.endColumn,
		currentTag: parser.currentTag,
		currentAttr: parser.currentAttr,
		eventId: eventId
	};
}
function noop(){}

function TreeError(message, code, state) {
	this.message = message;
	this.code = code;
	this.state = state;
	if (arguments.length > 2) this.extras = slice.call(arguments, 2);
}
TreeError.prototype = new Error;
TreeError.prototype.constructor = TreeError;
TreeError.prototype.name = 'TreeError';
TreeError.prototype.code = NaN;
TreeError.prototype.state = null;
TreeError.prototype.extras = null;

function TreeBuilder(opt) {
	opt = opt || {};
	this.treeEvent = opt instanceof Function ? opt : opt.treeEvent || noop;
	var element = opt.element || {};
	var elInit = element.init;
	var ElName = element.name;
	var ElAttrs = element.attrs;
	var ElChildren = element.children;
	this.elementInit = elInit instanceof Function ? elInit : elementDefault.elementInit;
	this.elementName = ElName instanceof Function ? new ElName : new elementDefault.Name(ElName);
	this.elementAttrs = ElAttrs instanceof Function ? new ElAttrs : new elementDefault.Attributes(ElAttrs);
	this.elementChildren = ElChildren instanceof Function ? new ElChildren : new elementDefault.Children(ElChildren);
	this.scopeNewChild();
	this.root = this.currentScope;
	this.path = [];
	this.errors = [];
}
TreeBuilder.prototype = {
	constructor: TreeBuilder,
	treeEvent: null,
	root: null,
	currentScope: null,
	closeTagMatch: null,
	path: null,
	errors: null,
	parserEvent: function(ev) {
		var handler = this.events[ev.name];
		if (handler) {
			handler.apply(this, slice.call(arguments, 1));
		}
	},
	newElement: function() {
		var el = this.elementInit();
		this.elementName.init(el);
		this.elementAttrs.init(el);
		this.elementChildren.init(el);
		return el;
	},
	scopeNewChild: function() {
		var parent = this.currentScope;
		var child = this.newElement();
		this.currentScope = {
			tag: child,
			parentScope: parent
		};
	},
	getSimpleBreadcrumb: function(p) {
		return {
			tag: this.elementName.get(p.tag),
			parentTag: this.elementName.get(p.parentScope.tag),
			parentChildren: this.elementChildren.getCount(p.parentScope.tag)
		};
	},
	getSimplePath: function() {
		var path = this.path;
		var list = [];
		var c = path.length;
		for (var i = 0; i < c; i++) {
			list.push(this.getSimpleBreadcrumb(path[i]));
		}
		return list;
	},
	openTag: function(streamTag, parser, eventId) {
		this.scopeNewChild();
		this.elementName.set(this.currentScope.tag, streamTag.name);
		this.treeEvent('tagOpenStart', null, this.currentScope, streamTag, parser, eventId);
	},
	findAndCloseTag: function(streamTag, parser, eventId) {
		var err;
		var tagOpen = this.findTagOpen(streamTag);
		if (tagOpen) {
			var breadcrumb = tagOpen.match;
			var unclosed = tagOpen.unclosedTags;
			var uclen = unclosed.length;
			if (streamTag.selfClose) breadcrumb.tag.selfClose = true;
			if (uclen) {
				err = new TreeError(
					(streamTag.selfClose ? 'Self closing tag ' : 'Close tag ')+
					JSON.stringify(streamTag.name)+' with '+uclen+' open tags',
					streamTag.selfClose ? 101 : 100,
					parserState(parser, eventId),
					{
						path: this.path,
						pathIndex: tagOpen.index,
						tagClose: streamTag,
						tagOpen: breadcrumb.tag,
						unclosedTags: unclosed
					}
				);
				this.errors.push(err);
				this.treeEvent('error', err, breadcrumb, streamTag, parser, eventId);
				// @TODO this.resolveUnclosedTags(breadcrumb, unclosed);
			}
			this.treeEvent('tagCloseStart', null, breadcrumb, streamTag, parser, eventId);
			this.closeTagMatch = tagOpen;
		} else {
			err = new TreeError(
				'Close tag '+JSON.stringify(ctag.name)+' without opening tag',
				102,
				parserState(parser, eventId)
			);
			this.errors.push(err);
			this.treeEvent('error', err, null, streamTag, parser, eventId);
		}
	},
	findTagOpen: function(ctag) {
		var p = this.path;
		var match, i;
		for (i = p.length - 1; 0 <= i; i--) {
			var ptag = p[i];
			if (this.elementName.get(ptag.tag) === ctag.name) {
				match = ptag;
				break;
			}
		}
		if (match) return {
			match: match,
			index: i,
			unclosedTags: p.slice(i+1)
		};
	},
	events: events
};

TreeBuilder.TreeError = TreeError;
TreeBuilder.parserState = parserState;

export default TreeBuilder;
