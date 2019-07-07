
var slice = Array.prototype.slice;

var events = {
	tagName: function(streamTag, parser, eventId) {
		if (streamTag.close) {
			this.findAndCloseTag(streamTag, parser, eventId);
		} else {
			this.openTag(streamTag, parser, eventId);
		}
	},
	endTag: function(streamTag, parser, eventId) {
		var breadcrumb = this.currentTag;
		if (!streamTag.close) {
			this.treeEvent('tagOpenEnd', null, breadcrumb, streamTag, parser, eventId);
			this.path.push(breadcrumb);
			this.currentChildren.push(breadcrumb.tag);
			this.currentChildren = breadcrumb.tag.children;
		}
		if (streamTag.selfClose) {
			this.findAndCloseTag(streamTag, parser, eventId);
		}
		if (streamTag.close || streamTag.selfClose) {
			var tagOpen = this.closeTagMatch;
			var breadcrumbClose = tagOpen.match;
			this.treeEvent('tagCloseEnd', null, breadcrumbClose, streamTag, parser, eventId);
			this.path = this.path.slice(0, tagOpen.index);
			this.currentTag = breadcrumbClose.parentTag;
			this.currentChildren = breadcrumbClose.parentChildren;
			this.closeTagMatch = null;
		}
	},
	text: function(text) {
		this.currentChildren.push(text);
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

function TreeError(message, state) {
	this.message = message;
	this.state = state;
	if (arguments.length > 2) this.extras = slice.call(arguments, 2);
}
TreeError.prototype = new Error;
TreeError.prototype.constructor = TreeError;
TreeError.prototype.name = 'TreeError';
TreeError.prototype.state = null;
TreeError.prototype.extras = null;

function TreeBuilder(opt) {
	if (opt instanceof Function) {
		this.treeEvent = opt;
	} else if (opt) {
		this.opt = opt;
		this.treeEvent = opt.event;
	}
	if (!(this.treeEvent instanceof Function)) {
		this.treeEvent = noop;
	}
	this.root = this.currentChildren = [];
	this.path = [];
	this.errors = [];
}
TreeBuilder.prototype = {
	constructor: TreeBuilder,
	opt: null,
	treeEvent: null,
	root: null,
	currentTag: null,
	currentChildren: null,
	closeTagMatch: null,
	path: null,
	errors: null,
	parserEvent: function(ev) {
		var handler = this.events[ev.name];
		if (handler) {
			handler.apply(this, slice.call(arguments, 1));
		}
	},
	getSimpleBreadcrumb: function(p) {
		return {
			tag: p.tag.name,
			parentTag: p.parentTag && p.parentTag.name,
			parentChildren: p.parentChildren.length
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
		var parentTag = this.currentTag;
		var treeTag = {
			name: streamTag.name,
			attrs: [],
			children: []
		};
		var breadcrumb = {
			tag: treeTag,
			parentTag: parentTag,
			parentChildren: this.currentChildren
		};
		this.currentTag = breadcrumb;
		this.treeEvent('tagOpenStart', null, breadcrumb, streamTag, parser, eventId);
		// console.log('tagOpen', simplePath(this.path));
	},
	findAndCloseTag: function(streamTag, parser, eventId) {
		var err;
		var tagOpen = this.findTagOpen(streamTag);
		if (tagOpen) {
			var breadcrumb = tagOpen.match;
			var unclosed = tagOpen.unclosedTags;
			var uclen = unclosed.length;
			if (uclen) {
				err = new TreeError(
					(streamTag.selfClose ? 'Self closing tag ' : 'Close tag ')+
					JSON.stringify(streamTag.name)+' with '+uclen+' open tags',
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
				parserState(parser, eventId)
			)
			this.errors.push(err);
			this.treeEvent('error', err, null, streamTag, parser, eventId);
		}
		// console.log('tagClose', simplePath(this.path));
	},
	findTagOpen: function(ctag) {
		var p = this.path;
		var match, i;
		for (i = p.length - 1; 0 <= i; i--) {
			var ptag = p[i];
			if (ptag.tag.name === ctag.name) {
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
