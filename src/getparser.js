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
		getResult: function({ asNode } = { asNode: undefined }) {
			var error = tb.errors;
			if (tb.root && tb.root.tag) {
				var tree = tb.root.tag;
			}
			tree = asNode ? tree : elAdapter.childrenGet(tree);
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
