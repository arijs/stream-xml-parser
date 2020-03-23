
function HTMLTypeset() {
	this.errors = [];
	this.text = [];
	this.rootStyle = {
		fontFace: 'helvetica',
		fontSize: 10,
		fontBold: false,
		fontItalic: false,
		lineLeading: 15,
		paragraphLeading: 25,
		tolerance: void 0
	};
	this.scopeReset();
	this.treeEvent = this.treeEvent.bind(this);
}
HTMLTypeset.prototype = {
	errors: null,
	text: null,
	currentParagraph: null,
	currentScope: null,
	pathScope: null,
	currentSpan: null,
	rootStyle: null,
	reInline: /^em$|^span$|^strong$|^b$|^i$/i,
	reBold: /^strong$|^b$/i,
	reItalic: /^em$|^i$/i,
	ensureParagraph: function () {
		if (this.currentParagraph) return;
		var s = this.currentScope || this.rootStyle;
		this.currentParagraph = {
			leading: s.lineLeading,
			paragraphLeading: s.paragraphLeading,
			tolerance: s.tolerance,
			spans: []
		};
	},
	pushParagraph: function () {
		if (!this.currentParagraph) return;
		this.pushSpan();
		this.text.push(this.currentParagraph);
		this.currentParagraph = void 0;
	},
	ensureSpan: function () {
		this.ensureParagraph();
		if (this.currentSpan) return;
		var cs = this.currentScope;
		this.currentSpan = {
			fontFamily: [
				cs.fontFace,
				(cs.fontBold || cs.fontItalic)
					? (cs.fontBold ? 'bold' : '') + (cs.fontItalic ? 'italic' : '')
					: 'normal'
			].join('\t'),
			fontSize: cs.fontSize,
			text: ''
		};
	},
	normalizeWhitespace: function(str) {
		return str.replace(/[ \r\n\t]+/g,' ');
	},
	decodeString: function(str) {
		return str;
		// this function is meant to be replaced
		// with a function to decode html entities
	},
	processTextCommit: function(text) {
		return this.decodeString(this.normalizeWhitespace(text));
	},
	pushSpan: function () {
		if (!this.currentSpan) return;
		var sText = this.currentSpan.text;
		if (sText) {
			this.currentSpan.text = this.processTextCommit(sText);
			this.currentParagraph.spans.push(this.currentSpan);
		}
		this.currentSpan = void 0;
	},
	scopeParent: function () {
		var cs = this.currentScope;
		return cs && cs.parent || this.rootStyle;
	},
	scopePush: function (tag, style) {
		var scope = this.currentScope || this.rootStyle;
		this.currentScope = {
			...scope,
			...style,
			tagOpen: tag,
			tagClose: null,
			parent: this.currentScope
		};
		this.pathScope.push(this.currentScope);
	},
	scopePop: function (tag) {
		this.currentScope.tagClose = tag;
		this.currentScope = this.currentScope.parent;
		this.pathScope.pop();
	},
	scopeReset: function () {
		this.currentScope = void 0;
		this.pathScope = [];
	},
	treeTagOpen: function(tagName, tag) {
		var style = {};
		if (this.reBold.test(tagName)) style.fontBold = true;
		if (this.reItalic.test(tagName)) style.fontItalic = true;
		this.scopePush(tag || tagName, style);
		if (this.reInline.test(tagName)) {
			this.pushSpan();
		} else {
			this.pushParagraph();
		}
	},
	treeTagClose: function(tagName, tag) {
		this.scopePop(tag);
		if (this.reInline.test(tagName)) {
			this.pushSpan();
		} else {
			this.pushParagraph();
		}
	},
	processTextInput: function(text) {
		return text;
	},
	treeText: function(text) {
		this.ensureSpan();
		this.currentSpan.text += this.processTextInput(text);
	},
	treeOnError: function(ev) {
		this.errors.push(ev);
	},
	treeEvent: function(ev) {
		var evName = ev.name;
		var tag = ev.tag;
		var tagName = tag && tag.name;
		if (ev.error) this.treeOnError(ev);
		switch (evName) {
			case 'tagOpenEnd': this.treeTagOpen(tagName, tag); break;
			case 'tagCloseEnd': this.treeTagClose(tagName, tag); break;
			case 'text': this.treeText(ev.text); break;
		}
	},
	getResult: function() {
		this.pushParagraph();
		return {
			errors: this.errors,
			result: this.text
		};
	}
};

export default HTMLTypeset;
