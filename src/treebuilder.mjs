
var slice = Array.prototype.slice;

var events = {
	startTag: function(ev) {
		this.treeEvent('tagInit', null, ev);
	},
	startInstruction: function(ev) {
		this.scopeNewChild(TreeBuilder.TAG_INSTRUCTION, ev);
		this.treeEvent('tagInstructionStart', null, ev);
	},
	endInstruction: function(ev) {
		var cs = this.currentScope;
		var parent = cs;
		var tag = this.element.initInstruction(ev.tag.text);
		if (cs.tag !== TreeBuilder.TAG_INSTRUCTION) {
			var err = new TreeError(
				'Current open tag is not an instruction',
				120,
				this.getScopeState(ev, tag)
			);
			this.errors.push(err);
			this.treeEvent('error', err, ev);
		} else {
			cs.tag = tag;
			parent = cs.parentScope;
		}
		this.element.childElement(parent.tag, tag);
		this.treeEvent('tagInstructionEnd', null, ev);
		this.currentScope = parent;
	},
	startDeclaration: function(ev) {
		this.scopeNewChild(TreeBuilder.TAG_DECLARATION, ev);
		this.treeEvent('tagDeclarationStart', null, ev);
	},
	endDeclaration: function(ev) {
		var cs = this.currentScope;
		var parent = cs;
		var tag = this.element.initDeclaration(ev.tag.text);
		if (cs.tag !== TreeBuilder.TAG_DECLARATION) {
			var err = new TreeError(
				'Current open tag is not a declaration',
				121,
				this.getScopeState(ev, tag)
			);
			this.errors.push(err);
			this.treeEvent('error', err, ev);
		} else {
			cs.tag = tag;
			parent = cs.parentScope;
		}
		this.element.childElement(parent.tag, tag);
		this.treeEvent('tagDeclarationEnd', null, ev);
		this.currentScope = parent;
	},
	startComment: function(ev) {
		this.scopeNewChild(TreeBuilder.TAG_COMMENT, ev);
		this.treeEvent('tagCommentStart', null, ev);
	},
	endComment: function(ev) {
		var cs = this.currentScope;
		var parent = cs;
		var tag = this.element.initComment(ev.tag.textComment);
		if (cs.tag !== TreeBuilder.TAG_COMMENT) {
			var err = new TreeError(
				'Current open tag is not a comment',
				122,
				this.getScopeState(ev, tag)
			);
			this.errors.push(err);
			this.treeEvent('error', err, ev);
		} else {
			cs.tag = tag;
			parent = cs.parentScope;
		}
		this.element.childElement(parent.tag, tag);
		this.treeEvent('tagCommentEnd', null, ev);
		this.currentScope = parent;
	},
	tagName: function(ev) {
		if (ev.tag.close) {
			this.findAndCloseTag(ev);
		} else {
			this.openTag(ev);
		}
	},
	tagAttribute: function(ev) {
		this.element.attrsAdd(this.currentScope.tag, ev.attr, ev, this);
	},
	endTag: function(ev) {
		var breadcrumb = this.currentScope;
		var tagClose = ev.tag.close;
		var tagSelfClose = ev.tag.selfClose;
		if (!tagClose) {
			this.treeEvent('tagOpenEnd', null, ev);
			this.path.push(breadcrumb);
			this.element.childElement(breadcrumb.parentScope.tag, breadcrumb.tag, ev, this);
		}
		if (tagSelfClose) {
			this.findAndCloseTag(ev);
		}
		if (tagClose || tagSelfClose) {
			var tagOpen = this.closeTagMatch;
			// if tagOpen has no value, an error was already fired
			// in the function findAndCloseTag
			if (tagOpen) {
				var breadcrumbClose = tagOpen.match;
				this.treeEvent('tagCloseEnd', null, ev);
				this.path = this.path.slice(0, tagOpen.pathIndex);
				this.currentScope = breadcrumbClose.parentScope;
				this.closeTagMatch = null;
			}
		}
	},
	text: function(ev) {
		this.treeEvent('text', null, ev);
		this.element.childText(this.currentScope.tag, ev.text, ev, this);
	},
	info: function(ev) {
		this.treeEvent('info', null, ev);
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
	if (opt instanceof Function) opt = {event:opt};
	if (opt) opt = {...TreeBuilder.optDefault, ...opt};
	else opt = {...TreeBuilder.optDefault};
	this.eventFn = opt.event || noop;
	this.element = opt.element;
	this.tagVoidMap = opt.tagVoidMap;
	if (opt.unclosedTagChildren) {
		this.unclosedTagChildren = opt.unclosedTagChildren;
	}
	this.scopeNewChild(this.element.initRoot());
	this.root = this.currentScope;
	this.path = [];
	this.errors = [];
	this.parserEvent = this.parserEvent.bind(this);
}
TreeBuilder.optDefault = {
	element: null,
	tagVoidMap: null,
	unclosedTagChildren: null,
};
TreeBuilder.TAG_INSTRUCTION = {tag:'#instruction'};
TreeBuilder.TAG_DECLARATION = {tag:'#declaration'};
TreeBuilder.TAG_COMMENT = {tag:'#comment'};
TreeBuilder.prototype = {
	constructor: TreeBuilder,
	eventFn: null,
	root: null,
	currentScope: null,
	closeTagMatch: null,
	path: null,
	errors: null,
	tagVoidMap: null,
	parserEvent: function(ev) {
		var handler = this.events[ev.name];
		if (handler) {
			handler.call(this, ev);
		}
	},
	getParserState: function({parser, id}) {
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
			eventId: id
		};
	},
	getEventObject: function(name, error, event) {
		var cs = this.currentScope;
		return {
			name,
			error,
			event,
			tag: cs.tag,
			text: event.text,
			parent: cs.parentScope,
			path: this.path,
			tagClose: this.closeTagMatch,
			builder: this
		};
	},
	getScopeState: function(evEnd, tagEnd) {
		var cs = this.currentScope;
		return {
			tag: cs.tag,
			evStart: cs.evStart,
			evEnd,
			tagEnd
		};
	},
	treeEvent: function(name, error, ev) {
		this.eventFn(this.getEventObject(name, error, ev));
	},
	scopeNewChild: function(child, ev) {
		var parent = this.currentScope;
		this.currentScope = {
			tag: child,
			evStart: ev,
			parentScope: parent
		};
	},
	openTag: function(ev) {
		this.scopeNewChild(this.element.initName(ev.tag.name), ev);
		this.treeEvent('tagOpenStart', null, ev);
	},
	unclosedTagChildren: function(tag) { // , index, ev
		var name = this.element.nameGet(tag);
		name = String(name).toLowerCase();
		if (this.tagVoidMap[name]) return 0;
	},	
	resolveUnclosedTags: function(unclosed, ev) {
		var uclen = unclosed.length;
		while (uclen) {
			var ucIndex = uclen - 1;
			var uc = unclosed[ucIndex];
			var ucTag = uc.tag;
			var ucEv = this.getEventObject('resolveUnclosedTags', null, ev);
			var ucCount = this.unclosedTagChildren(ucTag, ucIndex, ucEv);
			if (ucCount === void 0) break;
			var ucParent = uc.parentScope.tag;
			var ucSiblings = ucParent.children;
			var ucSelfPos = ucSiblings.indexOf(ucTag);
			if (-1 === ucSelfPos) {
				err = new TreeError(
					'Could not find child tag '+JSON.stringify(ucTag.name)+
					' in parent tag '+JSON.stringify(ucParent.name)+
					' list of '+ucSiblings.length+' children',
					103
				);
				this.errors.push(err);
				this.treeEvent('error', err, ev);
				break;
			} else {
				var ucRemCount = ucTag.children.length - ucCount;
				var ucRem = this.element.childSplice(ucTag, ucCount, ucRemCount, [], ev, this);
				this.element.childSplice(ucParent, ucSelfPos+1, 0, ucRem, ev, this);
				this.treeEvent('tagCloseStart', null, ev);
				this.treeEvent('tagCloseEnd', null, ev);
				unclosed.pop();
				uclen--;
				this.path.pop();
				this.currentScope = this.currentScope.parentScope;
			}
		}
		return unclosed;
	},
	findAndCloseTag: function(ev) {
		var err;
		var streamTag = ev.tag;
		var tagOpen = this.findTagOpen(streamTag, ev);
		this.closeTagMatch = tagOpen;
		if (tagOpen) {
			var breadcrumb = tagOpen.match;
			if (streamTag.selfClose) breadcrumb.tag.selfClose = true;
			var unclosed = this.resolveUnclosedTags(tagOpen.unclosedTags, ev);
			var uclen = unclosed.length;
			if (uclen) {
				err = new TreeError(
					(streamTag.selfClose ? 'Self closing tag ' : 'Close tag ')+
					JSON.stringify(streamTag.name)+' with '+uclen+' open tags',
					streamTag.selfClose ? 101 : 100
				);
				this.errors.push(err);
				this.treeEvent('unclosedTags', err, ev);
			}
			this.treeEvent('tagCloseStart', null, ev);
		} else {
			err = new TreeError(
				'Close tag '+JSON.stringify(streamTag.name)+' without opening tag',
				102
			);
			this.errors.push(err);
			this.treeEvent('unopenedTag', err, ev);
		}
	},
	findTagOpen: function(streamTag, ev) {
		var p = this.path;
		var match, i;
		for (i = p.length - 1; 0 <= i; i--) {
			var ptag = p[i];
			if (this.element.nameGet(ptag.tag, ev, this) === streamTag.name) {
				match = ptag;
				break;
			}
		}
		if (match) return {
			match: match,
			pathIndex: i,
			unclosedTags: p.slice(i+1)
		};
	},
	events: events
};

TreeBuilder.TreeError = TreeError;

export default TreeBuilder;
