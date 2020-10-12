import XMLParser from './xmlparser';
import TreeBuilder from './treebuilder';
import elementDefault from './element/default';
import defaultTagVoidMap from './htmlvoidtagmap';

export default function getParser(elAdapter, tagVoidMap) {
	elAdapter = elAdapter || elementDefault();
	tagVoidMap = tagVoidMap || defaultTagVoidMap;
	var tb = new TreeBuilder({
		element: elAdapter,
		tagVoidMap
	});
	var xp = new XMLParser(tb.parserEvent.bind(tb));

	return {
		write: xp.write.bind(xp),
		end: xp.end.bind(xp),
		getResult: function({ asNode } = {}) {
			var error = tb.errors;
			var tree = asNode ? tb.root.tag : elAdapter.childrenGet(tb.root.tag);
			if (error instanceof Array && 0 === error.length) error = null;
			return {
				error,
				tree,
				elAdapter,
				builder: tb,
				parser: xp
			};
		},
		elAdapter
	};
}
