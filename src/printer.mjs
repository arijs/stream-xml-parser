
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
}

Printer.optDefault = {
	tagVoidMap: null
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
		var nl = this.newLine;
		var nc = this.elAdapter.childCount(node);
		var sc = 0 == nc && this.isVoidTag(node);
		var out = this.printIndent(level);
		out += this.printTagOpen(node, sc);
		if (nc > 0) {
			out += nl + this.printTagChildren(node, level+1, path.concat([node]));
			out += this.printIndent(level);
		}
		if (!sc) {
			out += this.printTagClose(node);
		}
		out += nl;
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
			var nl = this.newLine;
			var sc = 0 == nc && this.isVoidTag(node);
			var out = this.printIndent(level);
			out += this.printTagOpen(node, sc);
			if (children) {
				out += nl + children + this.printIndent(level);
			}
			if (!sc) {
				out += this.printTagClose(node);
			}
			out += nl;
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
	printText: function(ftext, level) {
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
		return cbPrint(null, this.printText(ftext, level));
	},
	print: function(tree, level, path) {
		var tc = tree.length;
		var out = '';
		path = path || [];
		for (var i = 0; i < tc; i++) {
			var node = tree[i];
			if (this.elAdapter.isText(node)) {
				out += this.printText(this.elAdapter.textValueGet(node), level, path);
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
