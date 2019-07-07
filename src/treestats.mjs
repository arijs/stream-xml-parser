
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
	tagInit: function statsTagInit(err, bc, streamTag, parser) {
		this.statsLastTagInit = {
			tag: streamTag,
			pos: getPosStart(parser)
		};
	},
	tagOpenStart: function statsTagOpenStart(err, bc, streamTag, parser) {
		var s = bc.tag.stats;
		s || (s = bc.tag.stats = {});
		var sl = this.statsLastTagInit;
		s.openSource = streamTag;
		s.openStart = (sl && sl.tag === streamTag && sl.pos) || getPosStart(parser);
	},
	tagOpenEnd: function statsTagOpenEnd(err, bc, streamTag, parser) {
		var s = bc.tag.stats;
		s || (s = bc.tag.stats = {});
		s.openEnd = getPosEnd(parser);
		this.statsLastTagInit = null;
	},
	tagCloseStart: function statsTagCloseStart(err, bc, streamTag, parser) {
		var s = bc.tag.stats;
		s || (s = bc.tag.stats = {});
		var sl = this.statsLastTagInit;
		s.closeSource = streamTag;
		s.closeStart = (sl && sl.tag === streamTag && sl.pos) || getPosStart(parser);
	},
	tagCloseEnd: function statsTagCloseEnd(err, bc, streamTag, parser) {
		var s = bc.tag.stats;
		s || (s = bc.tag.stats = {});
		s.closeEnd = getPosEnd(parser);
		this.statsLastTagInit = null;
	}
};
export default function statsEvent(ev) {
	var fn = statsEventMap[ev];
	if (fn) fn.apply(this, slice.call(arguments, 1));
};
