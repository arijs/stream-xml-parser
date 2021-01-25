
var slice = Array.prototype.slice;

function getPosStart(parser) {
	return {
		byte: parser.pos,
		line: parser.line,
		column: parser.column
	};
}
function getPosEnd(parser) {
	return {
		byte: parser.endPos,
		line: parser.endLine,
		column: parser.endColumn
	};
}

var statsEventMap = {
	tagInit: function statsTagInit(ev) {
		this.statsLastTagInit = {
			tag: ev.event.tag,
			pos: getPosStart(ev.event.parser)
		};
	},
	tagOpenStart: function statsTagOpenStart(ev) {
		var s = ev.tag.stats;
		s || (s = ev.tag.stats = {});
		var sl = this.statsLastTagInit;
		var streamTag = ev.event.tag;
		s.openSource = streamTag;
		s.openStart = (sl && sl.tag === streamTag && sl.pos) || getPosStart(ev.event.parser);
	},
	tagOpenEnd: function statsTagOpenEnd(ev) {
		var s = ev.tag.stats;
		s || (s = ev.tag.stats = {});
		s.openEnd = getPosEnd(ev.event.parser);
		this.statsLastTagInit = null;
	},
	tagCloseStart: function statsTagCloseStart(ev) {
		var s = ev.tag.stats;
		s || (s = ev.tag.stats = {});
		var sl = this.statsLastTagInit;
		var streamTag = ev.event.tag;
		s.closeSource = streamTag;
		s.closeStart = (sl && sl.tag === streamTag && sl.pos) || getPosStart(ev.event.parser);
	},
	tagCloseEnd: function statsTagCloseEnd(ev) {
		var s = ev.tag.stats;
		s || (s = ev.tag.stats = {});
		s.closeEnd = getPosEnd(ev.event.parser);
		this.statsLastTagInit = null;
	}
};
export default function statsEvent(ev) {
	var fn = statsEventMap[ev.name];
	if (fn) fn.call(this, ev);
};
