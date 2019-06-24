
var slice = Array.prototype.slice;
var events = {
	tagName: function(ctag, parser, eventId) {
		if (ctag.close) {
			var tagOpen = this.findTagOpen(ctag);
			if (openTag) {
				var unclosed = openTag.unclosedTags;
				if (unclosed.length) {
					this.resolveUnclosedTags(openTag.match, unclosed);
				}
			} else {
				this.errors.push(new TreeError(
					'Close tag '+JSON.stringify(ctag.name)+' without opening tag',
					parserState(parser, eventId)
				));
			}
		} else {
			this.currentTag = this.openTag(ctag);
		}
	},
	endTag: function(ctag) {

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
}
TreeError.prototype = new Error;
TreeError.prototype.constructor = TreeError;
TreeError.prototype.name = 'TreeError';
TreeError.prototype.state = null;

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
		this.events[ev].apply(this, slice.call(arguments, 1));
	},
	openTag: function(ctag) {
		return {
			sourceOpen: ctag,
			sourceClose: null,
			name: ctag.name,
			attrs: [],
			children: []
		};
	},
	findTagOpen: function(ctag) {
		var p = this.path;
		var match, i;
		for (i = p.length - 1; 0 <= i; i--) {
			var ptag = p[i];
			if (ptag.name === ctag.name) {
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
