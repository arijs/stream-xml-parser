import * as treeRender from './treerender';
import TreeBuilder from './treebuilder';
import TreeMatcher from './treematcher';
import Printer from './printer';
import elementDefault from './element/default';
import elementDom from './element/dom';
import elementSnabbdom from './element/snabbdom';
import htmlVoidTagMap from './htmlvoidtagmap';
import * as printerTransform from './printertransform';

TreeBuilder.optDefault.element = elementDefault;
TreeBuilder.optDefault.tagVoidMap = htmlVoidTagMap;
Printer.optDefault.tagVoidMap = htmlVoidTagMap;

export { default as XMLParser } from './xmlparser';
export {
	TreeBuilder,
	TreeMatcher,
	treeRender,
	elementDefault,
	elementDom,
	elementSnabbdom,
	htmlVoidTagMap,
	Printer,
	printerTransform
};
export { default as treeStats } from './treestats';
export { default as testList } from './testlist';
export { default as HTMLTypeset } from './htmltypeset';
export { default as getParser } from './getparser';
