import htmlVoidTagMap from './htmlvoidtagmap';

var echo = x => x;

export default function Printer(opt) {
	this.adapter = opt && opt.adapter;
	this.indent = opt && opt.indent;
	this.encodeString = opt && opt.encodeString || echo;
	this.encodeText = opt && opt.encodeText || this.encodeString;
	this.encodeTagName = opt && opt.encodeTagName || this.encodeString;
	this.encodeAttrName = opt && opt.encodeAttrName || this.encodeString;
	this.encodeAttrValue = opt && opt.encodeAttrValue || this.encodeString;
	this.selfCloseString = opt && opt.selfCloseString || this.selfCloseString;
	this.newLine = opt && opt.newLine || this.newLine;
}
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
		return htmlVoidTagMap[name];
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
	printTag: function(node, level) {
		var nl = this.newLine;
		var nc = this.elAdapter.childCount(node);
		var sc = 0 == nc && this.isVoidTag(node);
		var out = this.printIndent(level);
		out += this.printTagOpen(node, sc);
		if (nc > 0) {
			out += nl + this.print(this.elAdapter.childrenGet(node), level+1);
			out += this.printIndent(level);
		}
		if (!sc) {
			out += this.printTagClose(node);
		}
		out += nl;
		return out;
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
	print: function(tree, level) {
		var tc = tree.length;
		var out = '';
		for (var i = 0; i < tc; i++) {
			var node = tree[i];
			if (this.elAdapter.isText(node)) {
				out += this.printText(this.elAdapter.textValueGet(node), level);
			} else {
				out += this.printTag(node, level);
			}
		}
		return out;
	}
};
