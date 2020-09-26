import * as treeRender from './treerender';
import TreeBuilder from './treebuilder';
import Printer from './printer';
import elementDefault from './element/default';
import elementDom from './element/dom';
import elementSnabbdom from './element/snabbdom';
import htmlVoidTagMap from './htmlvoidtagmap';

TreeBuilder.optDefault.element = elementDefault;
TreeBuilder.optDefault.tagVoidMap = htmlVoidTagMap;
Printer.optDefault.tagVoidMap = htmlVoidTagMap;

export { default as XMLParser } from './xmlparser';
export {
	TreeBuilder,
	treeRender,
	elementDefault,
	elementDom,
	elementSnabbdom,
	htmlVoidTagMap,
	Printer
};
export { default as treeStats } from './treestats';
export { default as HTMLTypeset } from './htmltypeset';
