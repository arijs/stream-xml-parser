import * as treeRender from './treerender';
import TreeBuilder from './treebuilder';
import elementDefault from './element/default';
import elementSnabbdom from './element/snabbdom';
import htmlVoidTagMap from './htmlvoidtagmap';

TreeBuilder.optDefault.element = elementDefault;
TreeBuilder.optDefault.tagVoidMap = htmlVoidTagMap;

export { default as XMLParser } from './xmlparser';
export { default as treeStats } from './treestats';
export { default as HTMLTypeset } from './htmltypeset';
export {
	TreeBuilder,
	treeRender,
	elementDefault,
	elementSnabbdom,
	htmlVoidTagMap
};
