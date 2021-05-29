
var echo = x => x;

export default function Printer(opt) {
	if (opt) opt = {...Printer.optDefault, ...opt};
	else opt = {...Printer.optDefault};
	this.elAdapter = opt.elAdapter;
	this.indent = opt.indent;
	this.encodeString = opt.encodeString || echo;
	this.encodeText = opt.encodeText || this.encodeString;
	this.encodeTagName = opt.encodeTagName || this.encodeString;
	this.encodeAttrName = opt.encodeAttrName || this.encodeString;
	this.encodeAttrValue = opt.encodeAttrValue || this.encodeString;
	this.selfCloseString = opt.selfCloseString || this.selfCloseString;
	this.newLine = opt.newLine || this.newLine;
	this.tagVoidMap = opt.tagVoidMap;
	this.tagStrictMap = opt.tagStrictMap;
	this.noFormat = opt.noFormat;
	this.rootStrict = opt.rootStrict;
	if (opt.isStrictTag) {
		this.isStrictTag = opt.isStrictTag;
	}
}

Printer.optDefault = {
	tagVoidMap: null,
	tagStrictMap: null,
	noFormat: false,
	rootStrict: false,
	isStrictTag: null,
};

Printer.prototype = {
	constructor: Printer,
	elAdapter: null,
	indent: null,
	encodeString: null,
	encodeText: null,
	encodeTagName: null,
	encodeAttrName: null,
	encodeAttrValue: null,
	selfCloseString: ' /',
	newLine: '\n',
	tagVoidMap: null,
	tagStrictMap: null,
	rootStrict: false,
	log: function() {},
	repeat: function(n, c) {
		var s = '';
		while (n > 0) {
			s += c;
			n--;
		}
		return s;
	},
	printIndent: function(level) {
		var indent = this.indent;
		if (indent instanceof Function) {
			return indent(level);
		}
		if (null == indent) {
			indent = '\t';
		} else if (+indent === indent) {
			indent = this.repeat(indent, ' ');
		}
		return this.repeat(level, indent);
	},
	isVoidTag: function(node) {
		var name = this.elAdapter.nameGet(node);
		name = String(name || '').toLowerCase();
		return this.tagVoidMap[name];
	},
	isStrictTag: function(node) {
		var name = this.elAdapter.nameGet(node);
		name = String(name || '').toLowerCase();
		return this.tagStrictMap[name];
	},
	isStrictPath: function(path) {
		var plen = path.length;
		var last = plen > 0 && path[plen - 1];
		return last ? this.isStrictTag(last) : this.rootStrict;
	},
	printTagSpaceBeforeOpen: function(level) {
		return this.noFormat
			? ''
			: this.printIndent(level);
	},
	printTagSpaceAfterOpen: function(level, st) {
		return this.noFormat
			? ''
			: st ? '' : this.newLine;
	},
	printTagSpaceBeforeClose: function(level, st) {
		return this.noFormat
			? ''
			: st ? '' : this.printIndent(level);
	},
	printTagSpaceAfterClose: function() {
		return this.noFormat
			? ''
			: this.newLine;
	},
	printAttr: function(name, value) {
		var attr = this.encodeAttrName(name);
		if (null != value) {
			attr += '="'+this.encodeAttrValue(value)+'"';
		}
		return attr;
	},
	printTagOpen: function(node, isSelfClose) {
		var self = this;
		var name = this.elAdapter.nameGet(node);
		var tag = '<' + this.encodeTagName(name);
		this.elAdapter.attrsEach(node, function(name, value) {
			tag += ' '+self.printAttr(name, value);
		});
		tag += (isSelfClose ? this.selfCloseString : '') + '>';
		return tag;
	},
	printTagClose: function(node) {
		var name = this.elAdapter.nameGet(node);
		var tag = '</' + this.encodeTagName(name) + '>';
		return tag;
	},
	printTagChildren: function(node, level, path) {
		return this.print(this.elAdapter.childrenGet(node), level, path);
	},
	printTagChildrenAsync: function(node, level, path, cbPrint) {
		return this.printAsync(this.elAdapter.childrenGet(node), level, path, cbPrint);
	},
	printTag: function(node, level, path) {
		var nc = this.elAdapter.childCount(node);
		var sc = 0 == nc && this.isVoidTag(node);
		var st = this.isStrictTag(node);

		var out = this.printTagSpaceBeforeOpen(level, st, node);
		out += this.printTagOpen(node, sc);
		if (nc > 0) {
			out += this.printTagSpaceAfterOpen(level, st, node);
			out += this.printTagChildren(node, level+1, path.concat([node]));
			out += this.printTagSpaceBeforeClose(level, st, node);
		}
		if (!sc) {
			out += this.printTagClose(node);
		}
		out += this.printTagSpaceAfterClose(level, st, node);

		return out;
	},
	printTagAsync: function(node, level, path, cbPrint) {
		var nc = this.elAdapter.childCount(node);
		if (nc) {
			this.printTagChildrenAsync(node, level+1, path.concat([node]), cbChildren.bind(this));
		} else {
			cbChildren.call(this);
		}
		function cbChildren(err, children) {
			var sc = 0 == nc && this.isVoidTag(node);
			var st = this.isStrictTag(node);

			var out = this.printTagSpaceBeforeOpen(level, st, node);
			out += this.printTagOpen(node, sc);
			if (children) {
				out += this.printTagSpaceAfterOpen(level, st, node);
				out += children;
				out += this.printTagSpaceBeforeClose(level, st, node);
			}
			if (!sc) {
				out += this.printTagClose(node);
			}
			out += this.printTagSpaceAfterClose(level, st, node);

			cbPrint(err, out);
		}
	},
	textSplitLines: function(text) {
		return text.split(/\r\n|\n|\r/g);
	},
	textTrim: function(text) {
		return text.replace(/^[ \t\r\n]+|[ \t]+(?=[ \t])|[ \t\r\n]+$/g, '');
	},
	printTextLine: function(text, level) {
		var trim = this.textTrim(text);
		return trim ? this.printIndent(level) + trim : trim;
	},
	printText: function(ftext, level, path) {
		if (
			this.noFormat ||
			this.isStrictPath(path)
		) return ftext;
		var text = this.textTrim(ftext);
		text = this.textSplitLines(text);
		var c = text.length;
		var nl = this.newLine;
		var s = '';
		for (var i = 0; i < c; i++) {
			var l = this.printTextLine(text[i], level);
			s += l ? l + nl : '';
		}
		return s;
	},
	printTextAsync: function(ftext, level, path, cbPrint) {
		return cbPrint(null, this.printText(ftext, level, path));
	},
	printComment: function(ftext, level) {
		return this.printIndent(level) +
			'<!--' + ftext + '-->' +
			(this.noFormat ? '' : this.newLine);
	},
	printCommentAsync: function(ftext, level, path, cbPrint) {
		return cbPrint(null, this.printComment(ftext, level));
	},
	printDeclaration: function(ftext, level) {
		return this.printIndent(level) +
			'<!' + ftext + '>' +
			(this.noFormat ? '' : this.newLine);
	},
	printDeclarationAsync: function(ftext, level, path, cbPrint) {
		return cbPrint(null, this.printDeclaration(ftext, level));
	},
	printInstruction: function(ftext, level) {
		return this.printIndent(level) +
			'<?' + ftext + '>' +
			(this.noFormat ? '' : this.newLine);
	},
	printInstructionAsync: function(ftext, level, path, cbPrint) {
		return cbPrint(null, this.printInstruction(ftext, level));
	},
	print: function(tree, level, path) {
		var tc = tree.length;
		var out = '';
		path = path || [];
		for (var i = 0; i < tc; i++) {
			var node = tree[i];
			if (this.elAdapter.isText(node)) {
				out += this.printText(this.elAdapter.textValueGet(node), level, path);
			} else if (this.elAdapter.isComment(node)) {
				out += this.printComment(this.elAdapter.textValueGet(node), level, path);
			} else if (this.elAdapter.isDeclaration(node)) {
				out += this.printDeclaration(this.elAdapter.textValueGet(node), level, path);
			} else if (this.elAdapter.isInstruction(node)) {
				out += this.printInstruction(this.elAdapter.textValueGet(node), level, path);
			} else {
				out += this.printTag(node, level, path);
			}
		}
		return out;
	},
	printAsync: function(tree, level, path, cbPrint) {
		var out = '';
		path = path || [];
		cbNext = cbNext.bind(this);
		return runNext.call(this);
		function runNext() {
			if (tree.length) {
				var node = tree.shift();
				if (this.elAdapter.isText(node)) {
					this.printTextAsync(this.elAdapter.textValueGet(node), level, path, cbNext);
				} else if (this.elAdapter.isComment(node)) {
					this.printCommentAsync(this.elAdapter.textValueGet(node), level, path, cbNext);
				} else if (this.elAdapter.isDeclaration(node)) {
					this.printDeclarationAsync(this.elAdapter.textValueGet(node), level, path, cbNext);
				} else if (this.elAdapter.isInstruction(node)) {
					this.printInstructionAsync(this.elAdapter.textValueGet(node), level, path, cbNext);
				} else {
					this.printTagAsync(node, level, path, cbNext);
				}
			} else {
				cbPrint(null, out);
			}
		}
		function cbNext(err, printed) {
			if (err) return cbPrint(err, out);
			out += printed;
			runNext.call(this);
		}
	}
};
