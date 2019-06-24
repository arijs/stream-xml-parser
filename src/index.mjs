
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
		function eventEndTag(id, ev_custom) {
			buf = '';
			state = st_TEXT;
			event(ev_custom || ev_endTag, ctag, self, id);
			self.currentTag = ctag = null;
		}
		function eventTagAttr(id) {
			event(ev_tagAttribute, cattr, ctag, self, id);
			self.currentAttr = cattr = null;
		}
		function eventTagNameSlash(id) {
			ctag.name = tagNameSlash;
			event(ev_tagName, ctag, self, id);
			tagNameSlash = void 0;
		}
		var self = this;
		text = text || '';
		var tlen = text.length;
		var event = this.event;
		var state = this.state;
		var ctag = this.currentTag;
		var cattr = this.currentAttr;
		var buf = this.buffer;
		var pos = this.pos;
		var line = this.line;
		var column = this.column;
		var quoteChar, beforeClose, tagNameSlash;
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
								event(ev_text, buf, this, '10');
								buf = '';
							}
							state = st_TAG_START;
							this.currentTag = ctag = {};
							event(ev_startTag, ctag, this, '20');
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
							event(ev_startInstruction, ctag, this, '30');
							break;
						case '!':
							if (buf) ctag.startSpace = buf;
							ctag.declaration = true;
							buf = '';
							state = st_DECLARATION;
							event(ev_startDeclaration, ctag, this, '40');
							break;
						case '>':
							ctag.empty = true;
							if (buf) {
								if (ctag.close) {
									ctag.endSpace = buf;
								} else {
									ctag.startSpace = buf;
								}
							}
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
								event(ev_startComment, ctag, this, '80');
								break;
							}
						default:
							buf += c;
							if (buf.length === lenCdata && reCdata.test(buf)) {
								ctag.cdata = true;
								buf = '';
								state = st_CDATA;
								event(ev_startCdata, ctag, this, '90');
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
								event(ev_endComment, ctag, this, '100');
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
								event(ev_endCdata, ctag, this, '110');
								break;
							}
						default:
							buf += c;
					}
					break;
				case st_TAG_NAME:
					switch (c) {
						case '>':
							if (beforeClose) {
								ctag.name = beforeClose;
								ctag.selfClose = true;
								beforeClose = void 0;
							} else {
								ctag.name = buf;
							}
							event(ev_tagName, ctag, this, '120');
							eventEndTag('130');
							break;
						case '/':
							if (ctag.close) {
								buf += c;
							} else {
								beforeClose = buf;
								buf = '';
							}
							break;
						default:
							if (reSpace.test(c)) {
								if (beforeClose) {
									tagNameSlash = beforeClose;
									beforeClose = void 0;
									state = st_TAG_NAMED_SELFCLOSE;
								} else {
									ctag.name = buf;
									state = st_TAG_NAMED;
									event(ev_tagName, ctag, this, '140');
								}
								buf = c;
							} else if (beforeClose) {
								buf = beforeClose+'/'+c;
								beforeClose = void 0;
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
							beforeClose = buf;
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
							if (beforeClose) ctag.selfCloseSpace = beforeClose;
							if (buf) ctag.endSpace = buf;
							if (tagNameSlash) eventTagNameSlash('155');
							ctag.selfClose = true;
							beforeClose = void 0;
							eventEndTag('160');
							break;
						case '/':
							if (tagNameSlash) {
								tagNameSlash += '/';
								eventTagNameSlash('165');
							} else if (beforeClose) {
								this.currentAttr = cattr = {};
								cattr.startSpace = beforeClose;
								cattr.name = c;
								eventTagAttr('170');
							}
							beforeClose = buf;
							buf = '';
							break;
						default:
							if (reSpace.test(c)) {
								buf += c;
							} else {
								if (tagNameSlash) {
									tagNameSlash += '/';
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
							cattr.quotes = quoteChar = c;
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
						case quoteChar:
							quoteChar = void 0;
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
			event(ev_text, buf, this, '290');
			buf = '';
		}
	},
	end: function(text) {
		this.write(text, true);
	}
};

export default XMLParser;
