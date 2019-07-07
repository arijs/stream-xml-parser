
var slice = Array.prototype.slice;

var statsEventMap = {
	tagOpenStart: function statsTagOpenStart(err, bc, streamTag, parser) {
		var s = bc.tag.stats;
		s || (s = bc.tag.stats = {});
		s.openSource = streamTag;
		s.openStart = {
			byte: parser.pos,
			line: parser.line,
			column: parser.column
		};
	},
	tagOpenEnd: function statsTagOpenEnd(err, bc, streamTag, parser) {
		var s = bc.tag.stats;
		s || (s = bc.tag.stats = {});
		s.openEnd = {
			byte: parser.endPos,
			line: parser.endLine,
			column: parser.endColumn
		};
	},
	tagCloseStart: function statsTagCloseStart(err, bc, streamTag, parser) {
		var s = bc.tag.stats;
		s || (s = bc.tag.stats = {});
		s.closeSource = streamTag;
		s.closeStart = {
			byte: parser.pos,
			line: parser.line,
			column: parser.column
		};
	},
	tagCloseEnd: function statsTagCloseEnd(err, bc, streamTag, parser) {
		var s = bc.tag.stats;
		s || (s = bc.tag.stats = {});
		s.closeEnd = {
			byte: parser.endPos,
			line: parser.endLine,
			column: parser.endColumn
		};
	}
};
export default function statsEvent(ev) {
	var fn = statsEventMap[ev];
	if (fn) fn.apply(this, slice.call(arguments, 1));
};
