import * as elementDefault from './element/default';

var slice = Array.prototype.slice;

var events = {
	startTag: function(ev) {
		this.treeEvent('tagInit', null, ev);
	},
	tagName: function(ev) {
		if (ev.tag.close) {
			this.findAndCloseTag(ev);
		} else {
			this.openTag(ev);
		}
	},
	tagAttribute: function(ev) {
		this.elementAttrs.add(this.currentScope.tag, ev.attr);
	},
	endTag: function(ev) {
		var breadcrumb = this.currentScope;
		var tagClose = ev.tag.close;
		var tagSelfClose = ev.tag.selfClose;
		if (!tagClose) {
			this.treeEvent('tagOpenEnd', null, ev);
			this.path.push(breadcrumb);
			this.elementChildren.addElement(breadcrumb.parentScope.tag, breadcrumb.tag);
		}
		if (tagSelfClose) {
			this.findAndCloseTag(ev);
		}
		if (tagClose || tagSelfClose) {
			var tagOpen = this.closeTagMatch;
			var breadcrumbClose = tagOpen.match;
			this.treeEvent('tagCloseEnd', null, ev);
			this.path = this.path.slice(0, tagOpen.index);
			this.currentScope = breadcrumbClose.parentScope;
			this.closeTagMatch = null;
		}
	},
	text: function(text) {
		this.elementChildren.addText(this.currentScope.tag, text);
	}
};

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
	this.eventFn = opt instanceof Function
		? opt : opt.event || noop;
	var element = opt.element || {};
	var elInit = element.init;
	var ElName = element.name;
	var ElAttrs = element.attrs;
	var ElChildren = element.children;
	this.elementInit = elInit instanceof Function
		? elInit : elementDefault.elementInit;
	this.elementName = ElName instanceof Function
		? new ElName : new elementDefault.Name(ElName);
	this.elementAttrs = ElAttrs instanceof Function
		? new ElAttrs : new elementDefault.Attributes(ElAttrs);
	this.elementChildren = ElChildren instanceof Function
		? new ElChildren : new elementDefault.Children(ElChildren);
	this.scopeNewChild();
	this.root = this.currentScope;
	this.path = [];
	this.errors = [];
}
TreeBuilder.prototype = {
	constructor: TreeBuilder,
	eventFn: null,
	root: null,
	currentScope: null,
	closeTagMatch: null,
	path: null,
	errors: null,
	parserEvent: function(ev) {
		var handler = this.events[ev.name];
		if (handler) {
			handler.call(this, ev);
		}
	},
	getParserState: function({parser, id: eventId}) {
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
	},
	getEventObject: function(name, error, ev) {
		var cs = this.currentScope;
		return {
			name,
			error,
			event: ev,
			tag: cs.tag,
			parent: cs.parent,
			path: this.path,
			tagClose: this.closeTagMatch,
			builder: this
		};
	},
	treeEvent: function(name, error, ev) {
		this.eventFn(this.getEventObject(name, error, ev));
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
			parentTag: this.elementName.get(p.parent.tag),
			parentChildren: this.elementChildren.getCount(p.parent.tag)
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
	openTag: function(ev) {
		this.scopeNewChild();
		this.elementName.set(this.currentScope.tag, ev.tag.name);
		this.treeEvent('tagOpenStart', null, ev);
	},
	findAndCloseTag: function(ev) {
		var err;
		var streamTag = ev.tag;
		var tagOpen = this.findTagOpen(streamTag);
		this.closeTagMatch = tagOpen;
		if (tagOpen) {
			var breadcrumb = tagOpen.match;
			var unclosed = tagOpen.unclosedTags;
			var uclen = unclosed.length;
			if (streamTag.selfClose) breadcrumb.tag.selfClose = true;
			if (uclen) {
				err = new TreeError(
					(streamTag.selfClose ? 'Self closing tag ' : 'Close tag ')+
					JSON.stringify(streamTag.name)+' with '+uclen+' open tags',
					streamTag.selfClose ? 101 : 100
				);
				this.errors.push(err);
				this.treeEvent('error', err, ev);
				// @TODO this.resolveUnclosedTags(breadcrumb, unclosed);
			}
			this.treeEvent('tagCloseStart', null, ev);
		} else {
			err = new TreeError(
				'Close tag '+JSON.stringify(streamTag.name)+' without opening tag',
				102
			);
			this.errors.push(err);
			this.treeEvent('error', err, ev);
		}
	},
	findTagOpen: function(streamTag) {
		var p = this.path;
		var match, i;
		for (i = p.length - 1; 0 <= i; i--) {
			var ptag = p[i];
			if (this.elementName.get(ptag.tag) === streamTag.name) {
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

export default TreeBuilder;
