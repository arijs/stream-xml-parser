
var st_TEXT = {name:'TEXT'};
var st_TAG_START = {name:'TAG_START'};
var st_TAG_NAME = {name:'TAG_NAME'};
var st_TAG_NAMED = {name:'TAG_NAMED'};
var st_TAG_NAMED_SELFCLOSE = {name:'TAG_NAMED_SELFCLOSE'};
var st_ATTR_NAME = {name:'ATTR_NAME'};
var st_ATTR_NAMED = {name:'ATTR_NAMED'};
var st_ATTR_VALUE_START = {name:'ATTR_VALUE_START'};
var st_ATTR_VALUE_QUOTED = {name:'ATTR_VALUE_QUOTED'};
var st_ATTR_VALUE_RAW = {name:'ATTR_VALUE_RAW'};
var st_INSTRUCTION = {name:'INSTRUCTION'};
var st_DECLARATION = {name:'DECLARATION'};
var st_COMMENT = {name:'COMMENT'};
var st_CDATA = {name:'CDATA'};

var ev_text = {name:'text'};
var ev_startTag = {name:'startTag'};
var ev_endTag = {name:'endTag'};
var ev_startInstruction = {name:'startInstruction'};
var ev_endInstruction = {name:'endInstruction'};
var ev_startDeclaration = {name:'startDeclaration'};
var ev_endDeclaration = {name:'endDeclaration'};
var ev_startComment = {name:'startComment'};
var ev_endComment = {name:'endComment'};
var ev_startCdata = {name:'startCdata'};
var ev_endCdata = {name:'endCdata'};
var ev_tagName = {name:'tagName'};
var ev_tagAttribute = {name:'tagAttribute'};

var reSpace = /\s/;
var reCdata = /^\[CDATA\[$/i;
var lenCdata = 7;

function XMLParser(opt) {
	if (opt instanceof Function) {
		this.event = opt;
		this.opt = { event: opt };
	} else {
		this.event = opt.event;
		this.opt = opt;
	}
	this.state = st_TEXT;
	this.buffer = '';
}

XMLParser.prototype = {
	constructor: XMLParser,
	state: null,
	c: null,
	pos: 0,
	line: 0,
	column: 0,
	endPos: 0,
	endLine: 0,
	endColumn: 0,
	tagPath: null,
	currentTag: null,
	currentAttr: null,
	buffer: null,
	write: function(text, final) {
		function getEndChars(n) {
			var j = i + 1;
			if (j >= n) {
				return text.substr(j - n, n);
			} else {
				var blen = buf.length;
				if (j + blen >= n) {
					return buf.substr(blen - (n - j), n - j).concat(text.substr(0, j))
				} else {
					throw new Error('Requested '+n+' end characters but there are '+j+' in text beginning and '+blen+' in buffer');
				}
			}
		}
		function event(ev, id) {
			eventFn({
				name: ev.name,
				id: id,
				attr: cattr,
				tag: ctag,
				text: buf,
				parser: self
			});
		}
		function eventEndTag(id, ev_custom) {
			buf = '';
			state = st_TEXT;
			event(ev_custom || ev_endTag, id);
			self.currentTag = ctag = null;
		}
		function eventTagAttr(id) {
			event(ev_tagAttribute, id);
			self.currentAttr = cattr = null;
		}
		function eventTagNameSlash(id) {
			ctag.name = tagNameSlash;
			event(ev_tagName, id);
			tagNameSlash = void 0;
		}
		var self = this;
		text = text || '';
		var tlen = text.length;
		var eventFn = this.event;
		var state = this.state;
		var ctag = this.currentTag;
		var cattr = this.currentAttr;
		var buf = this.buffer;
		var pos = this.pos;
		var line = this.line;
		var column = this.column;
		var attrQuoteChar = this.attrQuoteChar;
		var tagBeforeClose = this.tagBeforeClose;
		var tagNameSlash = this.tagNameSlash;
		for (var i = 0; i < tlen; i++) {
			var c = this.c = text[i];
			pos++;
			if (c === '\n') {
				line++;
				column = 0;
			} else {
				column++;
			}
			this.endPos = pos;
			this.endLine = line;
			this.endColumn = column;
			switch (state) {
				case st_TEXT:
					switch (c) {
						case '<':
							if (buf) {
								event(ev_text, '10');
								buf = '';
							}
							state = st_TAG_START;
							this.currentTag = ctag = {};
							event(ev_startTag, '20');
							break;
						default:
							buf += c;
					}
					break;
				case st_TAG_START:
					switch (c) {
						case '?':
							if (buf) ctag.startSpace = buf;
							ctag.instruction = true;
							buf = '';
							state = st_INSTRUCTION;
							event(ev_startInstruction, '30');
							break;
						case '!':
							if (buf) ctag.startSpace = buf;
							ctag.declaration = true;
							buf = '';
							state = st_DECLARATION;
							event(ev_startDeclaration, '40');
							break;
						case '>':
							ctag.empty = true;
							if (buf) {
								if (ctag.close) {
									ctag.endSpace = buf;
								} else {
									ctag.startSpace = buf;
								}
								buf = '';
							}
							event(ev_tagName, '45');
							eventEndTag('50');
							break;
						case '/':
							ctag.close = true;
							if (buf) ctag.startSpace = buf;
							buf = '';
							break;
						default:
							if (reSpace.test(c)) {
								buf += c;
							} else {
								if (!buf) {
								} else if (ctag.close) {
									ctag.startCloseSpace = buf;
								} else {
									ctag.startSpace = buf;
								}
								state = st_TAG_NAME;
								buf = c;
							}
					}
					break;
				case st_INSTRUCTION:
					switch (c) {
						case '>':
							ctag.text = buf;
							eventEndTag('60', ev_endInstruction);
							break;
						default:
							buf += c;
					}
					break;
				case st_DECLARATION:
					switch (c) {
						case '>':
							ctag.text = buf;
							eventEndTag('70', ev_endDeclaration);
							break;
						case '-':
							if (getEndChars(2) === '--') {
								ctag.beforeComment = buf.substr(0, buf.length - 1);
								ctag.comment = true;
								buf = '';
								state = st_COMMENT;
								event(ev_startComment, '80');
								break;
							}
						default:
							buf += c;
							if (buf.length === lenCdata && reCdata.test(buf)) {
								ctag.cdata = true;
								buf = '';
								state = st_CDATA;
								event(ev_startCdata, '90');
								break;
							}
					}
					break;
				case st_COMMENT:
					switch (c) {
						case '-':
							if (getEndChars(2) === '--') {
								ctag.textComment = buf.substr(0, buf.length - 1);
								buf = '';
								state = st_DECLARATION;
								event(ev_endComment, '100');
								break;
							}
						default:
							buf += c;
					}
					break;
				case st_CDATA:
					switch (c) {
						case ']':
							if (getEndChars(2) === ']]') {
								ctag.textCdata = buf.substr(0, buf.length - 1);
								buf = '';
								state = st_DECLARATION;
								event(ev_endCdata, '110');
								break;
							}
						default:
							buf += c;
					}
					break;
				case st_TAG_NAME:
					switch (c) {
						case '>':
							if (tagBeforeClose) {
								ctag.name = tagBeforeClose;
								ctag.selfClose = true;
								this.tagBeforeClose = tagBeforeClose = void 0;
							} else {
								ctag.name = buf;
							}
							event(ev_tagName, '120');
							eventEndTag('130');
							break;
						case '/':
							if (ctag.close) {
								buf += c;
							} else {
								this.tagBeforeClose = tagBeforeClose = buf;
								buf = '';
							}
							break;
						default:
							if (reSpace.test(c)) {
								if (tagBeforeClose) {
									this.tagNameSlash = tagNameSlash = tagBeforeClose;
									this.tagBeforeClose = tagBeforeClose = void 0;
									state = st_TAG_NAMED_SELFCLOSE;
								} else {
									ctag.name = buf;
									state = st_TAG_NAMED;
									event(ev_tagName, '140');
								}
								buf = c;
							} else if (tagBeforeClose) {
								buf = tagBeforeClose+'/'+c;
								this.tagBeforeClose = tagBeforeClose = void 0;
							} else {
								buf += c;
							}
					}
					break;
				case st_TAG_NAMED:
					switch (c) {
						case '>':
							if (buf) ctag.endSpace = buf;
							eventEndTag('150');
							break;
						case '/':
							tagBeforeClose = buf;
							state = st_TAG_NAMED_SELFCLOSE;
							buf = '';
							break;
						default:
							if (reSpace.test(c)) {
								buf += c;
							} else {
								state = st_ATTR_NAME;
								this.currentAttr = cattr = {};
								if (buf) cattr.startSpace = buf;
								buf = c;
							}
					}
					break;
				case st_TAG_NAMED_SELFCLOSE:
					switch (c) {
						case '>':
							if (tagBeforeClose) ctag.selfCloseSpace = tagBeforeClose;
							if (buf) ctag.endSpace = buf;
							if (tagNameSlash) eventTagNameSlash('155');
							ctag.selfClose = true;
							this.tagBeforeClose = tagBeforeClose = void 0;
							eventEndTag('160');
							break;
						case '/':
							if (tagNameSlash) {
								this.tagNameSlash = tagNameSlash += '/';
								eventTagNameSlash('165');
							} else if (tagBeforeClose) {
								this.currentAttr = cattr = {};
								cattr.startSpace = beforeClose;
								cattr.name = c;
								eventTagAttr('170');
							}
							this.tagBeforeClose = tagBeforeClose = buf;
							buf = '';
							break;
						default:
							if (reSpace.test(c)) {
								buf += c;
							} else {
								if (tagNameSlash) {
									this.tagNameSlash = tagNameSlash += '/';
									eventTagNameSlash('175');
								}
								state = st_ATTR_NAME;
								this.currentAttr = cattr = {};
								if (buf) cattr.startSpace = buf;
								buf = c;
							}
					}
					break;
				case st_ATTR_NAME:
					switch (c) {
						case '>':
							cattr.name = buf;
							eventTagAttr('180');
							eventEndTag('190');
							break;
						case '=':
							cattr.name = buf;
							state = st_ATTR_VALUE_START;
							buf = '';
							break;
						default:
							if (reSpace.test(c)) {
								cattr.name = buf;
								state = st_ATTR_NAMED;
								buf = c;
							} else {
								buf += c;
							}
					}
					break;
				case st_ATTR_NAMED:
					switch (c) {
						case '>':
							ctag.endSpace = buf;
							eventTagAttr('200');
							eventEndTag('210');
							break;
						case '=':
							if (buf) cattr.eqSpace = buf;
							cattr.eq = true;
							state = st_ATTR_VALUE_START;
							buf = '';
							break;
						default:
							if (reSpace.test(c)) {
								buf += c;
							} else {
								if (cattr) {
									eventTagAttr('220');
								}
								state = st_ATTR_NAME;
								this.currentAttr = cattr = {};
								if (buf) cattr.startSpace = buf;
								buf = c;
							}
					}
					break;
				case st_ATTR_VALUE_START:
					switch (c) {
						case '>':
							if (buf) ctag.endSpace = buf;
							eventTagAttr('230');
							eventEndTag('240');
							break;
						case '"':
						case '\'':
							cattr.valueSpace = buf;
							this.attrQuoteChar = cattr.quotes = attrQuoteChar = c;
							state = st_ATTR_VALUE_QUOTED;
							buf = '';
							break;
						default:
							if (reSpace.test(c)) {
								buf += c;
							} else {
								if (buf) cattr.valueSpace = buf;
								state = stATTR_VALUE_RAW;
								buf = c;
							}
					}
					break;
				case st_ATTR_VALUE_RAW:
					switch (c) {
						case '>':
							cattr.value = buf;
							eventTagAttr('250');
							eventEndTag('260');
							break;
						default:
							if (reSpace.test(c)) {
								cattr.value = buf;
								state = st_TAG_NAMED;
								eventTagAttr('270');
								buf = c;
							} else {
								buf += c;
							}
					}
					break;
				case st_ATTR_VALUE_QUOTED:
					switch (c) {
						case attrQuoteChar:
							this.attrQuoteChar = attrQuoteChar = void 0;
							cattr.value = buf;
							buf = '';
							state = st_TAG_NAMED;
							eventTagAttr('280');
							break;
						default:
							buf += c;
					}
					break;
			}
			this.pos = this.endPos;
			this.line = this.endLine;
			this.column = this.endColumn;
		}
		this.c = void 0;
		this.state = state;
		if (final && state === st_TEXT && buf) {
			event(ev_text, '290');
			buf = '';
		}
		this.buffer = buf;
	},
	end: function(text) {
		this.write(text, true);
	}
};

export { XMLParser };
export { default as TreeBuilder } from './treebuilder';
export { default as treeStats } from './treestats';
