
var slice = Array.prototype.slice;

var statsEventMap = {
	tagOpenStart: function statsTagOpenStart(treeTag, streamTag, parser) {
		var s = treeTag.stats = {};
		s.openSource = streamTag;
		s.openStart = {
			byte: parser.pos,
			line: parser.line,
			column: parser.column
		};
	},
	tagOpenEnd: function statsTagOpenEnd(treeTag, streamTag, parser) {
		var s = treeTag.stats = {};
		s.openEnd = {
			byte: parser.endPos,
			line: parser.endLine,
			column: parser.endColumn
		};
	},
	tagCloseStart: function statsTagCloseStart(treeTag, streamTag, parser) {
		var s = treeTag.stats = {};
		s.closeSource = streamTag;
		s.closeStart = {
			byte: parser.pos,
			line: parser.line,
			column: parser.column
		};
	},
	tagCloseEnd: function statsTagCloseEnd(treeTag, streamTag, parser) {
		var s = treeTag.stats = {};
		s.closeEnd = {
			byte: parser.endPos,
			line: parser.endLine,
			column: parser.endColumn
		};
	}
};
export default function statsEvent(ev) {
	var fn = statsEventMap[ev];
	if (!fn) return;
	var args = slice.call(arguments, 1);
	fn.apply(this, args);
};
