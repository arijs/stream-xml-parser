
var slice = Array.prototype.slice;

function simplePath(path) {
	var list = [];
	var c = path.length;
	for (var i = 0; i < c; i++) {
		var p = path[i];
		list.push({
			tag: p.tag.name,
			parentTag: p.parentTag && p.parentTag.name,
			parentChildren: p.parentChildren.length
		});
	}
	return list;
}

var events = {
	tagName: function(ctag, parser, eventId) {
		if (ctag.close) {
			var tagOpen = this.findTagOpen(ctag);
			if (tagOpen) {
				var breadcrumb = tagOpen.match;
				var unclosed = tagOpen.unclosedTags;
				var uclen = unclosed.length;
				if (uclen) {
					this.errors.push(new TreeError(
						'Close tag '+JSON.stringify(ctag.name)+' with '+uclen+' open tags',
						parserState(parser, eventId),
						{
							path: this.path,
							pathIndex: tagOpen.index,
							tagClose: ctag,
							tagOpen: breadcrumb.tag,
							unclosedTags: unclosed
						}
					));
					// this.resolveUnclosedTags(breadcrumb, unclosed);
				}
				this.closeTag(breadcrumb, ctag, parser);
				this.path = this.path.slice(0, tagOpen.index);
				this.currentTag = breadcrumb.parentTag;
				this.currentChildren = breadcrumb.parentChildren;
			} else {
				this.errors.push(new TreeError(
					'Close tag '+JSON.stringify(ctag.name)+' without opening tag',
					parserState(parser, eventId)
				));
			}
			console.log('tagClose', simplePath(this.path));
		} else {
			var parentTag = this.currentTag;
			this.currentTag = this.openTag(ctag, parser);
			var breadcrumb = {
				tag: this.currentTag,
				parentTag: parentTag,
				parentChildren: this.currentChildren
			};
			this.path.push(breadcrumb);
			this.currentChildren.push(this.currentTag);
			this.currentChildren = this.currentTag.children;
			console.log('tagOpen', simplePath(this.path));
		}
	},
	endTag: function(ctag) {
		if (ctag.close) {
			
		} else if (ctag.selfClose) {

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
	this.opt = opt;
	this.root = this.currentChildren = [];
	this.path = [];
	this.errors = [];
}
TreeBuilder.prototype = {
	constructor: TreeBuilder,
	opt: null,
	root: null,
	currentTag: null,
	currentChildren: null,
	path: null,
	errors: null,
	parserEvent: function(ev) {
		var handler = this.events[ev.name];
		if (handler) {
			handler.apply(this, slice.call(arguments, 1));
		} else {
			console.log('no handler', ev)
		}
	},
	openTag: function(ctag, parser) {
		return {
			sourceOpen: ctag,
			sourceClose: null,
			posOpen: {
				byte: parser.pos,
				line: parser.line,
				column: parser.column
			},
			posClose: null,
			name: ctag.name,
			attrs: [],
			children: []
		};
	},
	closeTag: function(breadcrumb, ctag, parser) {
		var btag = breadcrumb.tag;
		btag.sourceClose = ctag;
		btag.posClose = {
			byte: parser.pos,
			line: parser.line,
			column: parser.column
		};
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
