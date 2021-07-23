import XMLParser from './xmlparser.mjs';
import TreeBuilder from './treebuilder.mjs';
import TreeMatcher from './treematcher.mjs';
import * as treeRender from './treerender.mjs';
import treeWalk from './treewalk.mjs';
import Printer from './printer.mjs';
import elementDefault from './element/default.mjs';
import elementDom from './element/dom.mjs';
import elementSnabbdom from './element/snabbdom.mjs';
import htmlVoidTagMap from './htmlvoidtagmap.mjs';
import htmlStrictTagMap from './htmlstricttagmap.mjs';
import * as printerTransform from './printertransform.mjs';

XMLParser.optDefault.tagStrictMap = htmlStrictTagMap;

TreeBuilder.optDefault.element = elementDefault;
TreeBuilder.optDefault.tagVoidMap = htmlVoidTagMap;

Printer.optDefault.tagVoidMap = htmlVoidTagMap;
Printer.optDefault.tagStrictMap = htmlStrictTagMap;

export {
	XMLParser,
	TreeBuilder,
	TreeMatcher,
	treeRender,
	treeWalk,
	elementDefault,
	elementDom,
	elementSnabbdom,
	htmlVoidTagMap,
	htmlStrictTagMap,
	Printer,
	printerTransform
};
export { default as treeStats } from './treestats.mjs';
export { default as testList } from './testlist.mjs';
export { default as HTMLTypeset } from './htmltypeset.mjs';
export { default as getParser } from './getparser.mjs';
