import XMLParser from './xmlparser';
import TreeBuilder from './treebuilder';
import elementDefault from './element/default';
import defaultTagVoidMap from './htmlvoidtagmap';
import defaultTagStrictMap from './htmlstricttagmap';

export default function getParser({
	elAdapter,
	tagVoidMap,
	tagStrictMap,
	unclosedTagChildren
} = {}) {
	elAdapter = null == elAdapter
		? elementDefault() : elAdapter;
	tagVoidMap = null == tagVoidMap
		? defaultTagVoidMap : tagVoidMap;
	tagStrictMap = null == tagStrictMap
		? defaultTagStrictMap : tagStrictMap;
	var tb = new TreeBuilder({
		element: elAdapter,
		tagVoidMap,
		unclosedTagChildren,
	});
	var xp = new XMLParser({
		event: tb.parserEvent.bind(tb),
		tagStrictMap,
	});

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
				parser: xp,
				tagVoidMap,
				tagStrictMap,
			};
		},
		elAdapter
	};
}
