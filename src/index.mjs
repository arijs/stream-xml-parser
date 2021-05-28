import XMLParser from './xmlparser';
import * as treeRender from './treerender';
import TreeBuilder from './treebuilder';
import TreeMatcher from './treematcher';
import Printer from './printer';
import elementDefault from './element/default';
import elementDom from './element/dom';
import elementSnabbdom from './element/snabbdom';
import htmlVoidTagMap from './htmlvoidtagmap';
import htmlStrictTagMap from './htmlstricttagmap';
import * as printerTransform from './printertransform';

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
	elementDefault,
	elementDom,
	elementSnabbdom,
	htmlVoidTagMap,
	htmlStrictTagMap,
	Printer,
	printerTransform
};
export { default as treeStats } from './treestats';
export { default as testList } from './testlist';
export { default as HTMLTypeset } from './htmltypeset';
export { default as getParser } from './getparser';
