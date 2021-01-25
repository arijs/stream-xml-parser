
/********************************* */
/** Utils                          */
/********************************* */

interface Collection<T> {
	[key: number]: T | number;
	length: number;
}

type TreeElement = object;

type TreeCollection = Array<TreeElement> | Collection<TreeElement>;

type TreeElementOrCollection = TreeCollection | TreeElement;

/********************************* */
/** XMLParser                      */
/********************************* */

interface XMLParserAttr {
	startSpace: string,
	name: string,
	eqSpace: string,
	value: string,
	valueSpace: string,
	quotes: string,
}

interface XMLParserTag {
	instruction: boolean,
	declaration: boolean,
	comment: boolean,
	empty: boolean,
	startSpace: string,
	close: boolean,
	name: string,
	startCloseSpace: string,
	selfClose: boolean,
	endSpace: string,
	text: string,
	textComment: string,
	textCdata: string,
}

interface XMLParserCustomAttrValueParserContext {
	attr?: XMLParserAttr,
	i?: number,
	pos: number,
	line: number,
	column: number,
}

interface XMLParserCustomAttrValueParser {
	push(c: string, ctx: XMLParserCustomAttrValueParserContext): XMLParserCustomAttrValueParserContext,
}

interface XMLParserCustomParserMap {
	attrValue(c: string, cattr: XMLParserAttr): XMLParserCustomAttrValueParser,
}

interface XMLParserCurrentCustomParserMap {
	attrValue: XMLParserCustomAttrValueParser,
}

interface XMLParserEvent {
	name: string,
	id: string,
	attr: XMLParserAttr,
	tag: XMLParserTag,
	text: string,
	parser: StreamXMLParser.XMLParser,
	customParser: XMLParserCurrentCustomParserMap
}

type XMLParserEventHandler = (event: XMLParserEvent) => void;

interface XMLParserOptions {
	event: XMLParserEventHandler,
	decodeString(s: string): string,
	decodeText(s: string): string,
	decodeTagName(s: string): string,
	decodeAttrName(s: string): string,
	decodeAttrValue(s: string): string,
}

/********************************* */
/** Tree TreeElement Adapter           */
/********************************* */

interface TreeElementAdapter {
	isText(el: TreeElement): boolean,
	isFragment(el: TreeElement): boolean,
	isComment(el: TreeElement): boolean,
	isDeclaration(el: TreeElement): boolean,
	isInstruction(el: TreeElement): boolean,
	isChildren(ch: TreeElement): boolean,
	initRoot(): TreeElement,
	initName(name: string): TreeElement,
	initComment(text: string): TreeElement,
	initDeclaration(text: string): TreeElement,
	initInstruction(text: string): TreeElement,
	nameGet(el: TreeElement): string,
	textNode(text: string): TreeElement,
	textValueGet(el: TreeElement): string,
	textValueSet(el: TreeElement, text: string): string,
	attrsAdd(el: TreeElement, attr: TreeElement),
	attrsEach(el: TreeElement, handler: (name: string, value: string, attr: object, index: number) => void): void,
	childElement(el: TreeElement, child: TreeElement): void,
	childText(el: TreeElement, text: string): void,
	childCount(el: TreeElement): number,
	childIndexGet(el: TreeElement, index: number): TreeElement,
	childSplice(el: TreeElement, index: number, remove?: number, add?: TreeElement[]): TreeElement[],
	childrenGet(el: TreeElement): TreeCollection,
	childrenSet(el: TreeElement, children: TreeCollection): TreeCollection,
	toArray(el: TreeElement): TreeElement[],
}

interface TreeElementAdapterDefaultOptions {
	keyName: string,
	keyAttrs: string,
	keyChildren: string,
	keyText: string,
	textName: string,
	rootName: string,
	commentName: string,
	declarationName: string,
	instructionName: string,
}

interface TreeElementAdapterDomChildNodes {
	constructor: Function,
}

interface TreeElementAdapterDomApi {
	createTextNode(text: string): object,
	createDocumentFragment(): object,
	createElement(name: string): object,
	createComment(text: string): object,
	childNodes: TreeElementAdapterDomChildNodes,
	DOCUMENT_FRAGMENT_NODE: number,
	COMMENT_NODE: number,
	TEXT_NODE: number,
}

interface TreeElementAdapterSnabbdomOptions {
	attrHandler(el: object, attr: object): any;
}

type TreeElementAdapterDefault = (opt: TreeElementAdapterDefaultOptions) => TreeElementAdapter;

type TreeElementAdapterDom = (opt: TreeElementAdapterDomApi) => TreeElementAdapter;

type TreeElementAdapterSnabbdom = (opt: TreeElementAdapterSnabbdomOptions) => TreeElementAdapter;

/********************************* */
/** Void tag map                   */
/********************************* */

interface VoidTagMap {
	[key: string]: boolean;
}

/********************************* */
/** Treebuilder                    */
/********************************* */

interface TreeBuilderScope {
	tag: TreeElement,
	evStart: XMLParserEvent,
	parent: TreeBuilderScope
}

interface TreeBuilderTagClose {
	match: TreeBuilderScope,
	pathIndex: number,
	unclosedTags: TreeBuilderScope[],
}

declare class TreeError extends Error {
	constructor(message: string, code: string | number, state: any, ...extras: any[]);
	code: string | number;
	state: any;
	extras: any[];
}

interface TreeBuilderEvent {
	name: string,
	error: TreeError,
	event: XMLParserEvent,
	tag: TreeElement,
	text: string,
	parent: TreeBuilderScope,
	path: TreeBuilderScope[],
	tagClose: TreeBuilderTagClose,
	builder: StreamXMLParser.TreeBuilder
}

type TreeBuilderEventHandler = (event: TreeBuilderEvent) => void;

interface TreeBuilderOptions {
	event: TreeBuilderEventHandler,
	TreeElement: TreeElementAdapter,
	tagVoidMap: VoidTagMap
}

type TreeBuilderXMLParserEventName =
	| 'startTag'
	| 'startInstruction'
	| 'endInstruction'
	| 'startDeclaration'
	| 'endDeclaration'
	| 'startComment'
	| 'endComment'
	| 'tagName'
	| 'tagAttribute'
	| 'endTag'
	| 'text';

/********************************* */
/** TreeMatcher                    */
/********************************* */

type TreeMatcherTestFunction = (value: any) => any;

type TreeMatcherTest = string | TreeMatcherTestFunction | RegExp;

interface TreeMatcherRuleOptions {
	repeatMin: number;
	repeatMax: number;
	repeatGreedy: boolean;
	source: any;
	normalizeNodeName: (string) => string;
	normalizeAttrName: (string) => string;
	normalizeAttrValue: (string) => string;
}

interface TreeMatcherRuleDefOptions {
	name: TreeMatcherRuleOptions,
	attrs: TreeMatcherRuleOptions,
	path: TreeMatcherRuleOptions,
}

type TreeMatcherRuleName = '*' | TreeMatcherTest;

interface TreeMatcherRuleAttrArray {
	0: TreeMatcherTest,
	1: TreeMatcherTest,
	2: TreeMatcherRuleOptions,
}

interface TreeMatcherRuleAttrObject {
	name: TreeMatcherTest,
	value: TreeMatcherTest,
	opt: TreeMatcherRuleOptions,
}

type TreeMatcherRuleAttr = string | TreeMatcherRuleAttrArray | TreeMatcherRuleAttrObject;

interface TreeMatcherRuleDefArray {
	0: TreeMatcherRuleName,
	1: TreeMatcherRuleAttr[],
	2: TreeMatcherDef[],
}

interface TreeMatcherRuleDefObject {
	name: TreeMatcherRuleName,
	attrs: TreeMatcherRuleAttr[],
	path: TreeMatcherDef[],
}

type TreeMatcherDef = StreamXMLParser.TreeMatcher | string | TreeMatcherRuleDefArray | TreeMatcherRuleDefObject;

type TreeMatcherNodeName = string;

interface TreeMatcherNodeAttr {
	name: string,
	value: string,
}

type TreeMatcherTestSuccess = boolean | any;

type TreeMatcherGetSuccessFunction = (value: any) => TreeMatcherTestSuccess;

interface TreeMatcherRuleObject {
	repeatMin: number,
	repeatMax: number,
	repeatGreedy: boolean,
	source: any,
	test(value: TreeMatcherNodeName | TreeMatcherNodeAttr): TreeMatcherTestSuccess,
	getSuccess: TreeMatcherGetSuccessFunction
}

interface TreeMatcherMethodReduceContext {
	first: boolean,
	rule: TreeMatcherRuleObject,
	item: any,
	itemResult: TreeMatcherTestSuccess,
	ruleIndex: number,
}

interface TreeMatcherMethodReduceResult {
	result: TreeMatcherTestSuccess,
	_break: boolean,
}

interface TreeMatcherMethod {
	init(rules: TreeMatcherRuleObject[]): any;
	reduce(itemSuccess: any, lastResult: any, reduceContext: TreeMatcherMethodReduceContext): TreeMatcherMethodReduceResult,
	final(value: TreeMatcherTestSuccess): TreeMatcherTestSuccess;
}

interface TreeMatcherTestAllSuccess {
	name: TreeMatcherTestSuccess,
	attr: TreeMatcherTestSuccess,
	path: TreeMatcherTestSuccess,
	success: TreeMatcherTestSuccess,
}

/********************************* */
/** treeRender                     */
/********************************* */

type TreeRenderPlugin = (nodeInput: TreeElement, sourceAdapter: TreeElementAdapter, ctx: any, targetAdapter: TreeElementAdapter, createTree: boolean, targetTree: TreeElementOrCollection) => TreeElementOrCollection;

interface TreeRenderOptions {
	plugin: TreeRenderPlugin,
	targetAdapter: TreeElementAdapter,
	createTree: boolean,
	targetTree: TreeElementOrCollection,
}

type TreeRenderPluginOrOptions = TreeRenderOptions | TreeRenderPlugin;

type TreeRender = (sourceTree: TreeElementOrCollection, sourceAdapter: TreeElementAdapter, ctx: any, plugins: TreeRenderPluginOrOptions[]) => TreeElementOrCollection;

/********************************* */
/** Printer                    */
/********************************* */

type PrinterIndent = number | string | ((level: number) => string);

type PrinterEncodeString = (value: string) => string;

interface PrinterOptions {
	elAdapter: TreeElementAdapter,
	indent: PrinterIndent,
	encodeString: PrinterEncodeString,
	encodeText: PrinterEncodeString,
	encodeTagName: PrinterEncodeString,
	encodeAttrName: PrinterEncodeString,
	encodeAttrValue: PrinterEncodeString,
	selfCloseString: string,
	newLine: string,
	tagVoidMap: VoidTagMap,
}

type PrinterCallback = (err: any, out: string) => any;

type PrintElement = (node: TreeElement, level: number, path: TreeElement[]) => string;
type PrintCollection = (tree: TreeCollection, level: number, path: TreeElement[]) => string;

type PrintElementAsync = (node: TreeElement, level: number, path: TreeElement[], cbPrint: PrinterCallback) => void;
type PrintCollectionAsync = (tree: TreeCollection, level: number, path: TreeElement[], cbPrint: PrinterCallback) => void;

/********************************* */
/** printerTransform               */
/********************************* */

interface printTreeSyncOptions {
	tree: TreeCollection,
	elAdapter: TreeElementAdapter,
	customPrintTag: PrintElement,
	path: object[],
	level: number,
}

interface printTreeAsyncOptions extends printTreeSyncOptions {
	callback: PrinterCallback;
}

interface printTransformReplacementItem {
	name: string,
	tree: TreeCollection,
	text: string,
	noFormat: boolean,
}

interface printTransformReplacement {
	name: string,
	before: printTransformReplacementItem,
	full: printTransformReplacementItem,
	fullSrc: string,
	prepend: printTransformReplacementItem,
	children: printTransformReplacementItem,
	childrenSrc: string,
	append: printTransformReplacementItem,
	after: printTransformReplacementItem,
	noFormat: boolean,
}

interface printTransformAsyncFunctionOptions {
	node: TreeElement,
	path: object[],
	level: number,
	elAdapter: TreeElementAdapter,
	printer: StreamXMLParser.Printer,
	callback(err: any, rep: printTransformReplacement): any,
}

interface printTransformAsyncOptions {
	tree: TreeCollection,
	elAdapter: TreeElementAdapter,
	transform(opt: printTransformAsyncFunctionOptions): any,
	callback(err: any[], page: string): any,
	level: number,
}

interface printTransformAsyncMatcherNode {
	node: TreeElement,
	path: TreeElement[],
	callback(err: any, rep: printTransformReplacement): any,
}

interface printTransformMatcherRule {
	matcher: TreeMatcherDef,
	opt: TreeMatcherRuleDefOptions,
	callback(opt: printTransformAsyncMatcherNode): any;
}

interface printTransformAsyncMatcherApi {
	addRule(opt: printTransformMatcherRule): void;
	clear(): void;
	onTest(opt: printTransformAsyncMatcherNode): void;
	onTestRule(result: any, success: any, rule: printTransformMatcherRule, opt: printTransformAsyncMatcherNode): void;
	isSuccess(result: any): any;
	transform(opt: printTransformAsyncMatcherNode): void;
}

/********************************* */
/** Export namespace               */
/********************************* */

declare module "StreamXMLParser" {
	export class XMLParser {
		constructor(opt: XMLParserOptions | XMLParserEventHandler);
		write(text: string, final: boolean): void;
		end(text: string): void;
	}
	export class TreeBuilder {
		constructor(opt: TreeBuilderOptions | TreeBuilderEventHandler);
		parserEvent(ev: XMLParserEvent): void;
		root: TreeBuilderScope;
	}
	export class TreeMatcher {
		constructor(elAdapter: TreeElementAdapter);
		static from(item: TreeMatcherDef, elAdapter: TreeElementAdapter, opt: TreeMatcherRuleDefOptions): TreeMatcher;
		elAdapter: TreeElementAdapter;
		name(testName: TreeMatcherRuleName, opt: TreeMatcherRuleOptions): void;
		attr(testAttr: TreeMatcherRuleAttr, opt: TreeMatcherRuleOptions): void;
		attrFromArray(list: TreeMatcherRuleAttr[], opt: TreeMatcherRuleOptions): void;
		path(testPath: TreeMatcherDef[], opt: TreeMatcherRuleOptions): void;
		testNodeName(node: object, method: TreeMatcherMethod): TreeMatcherTestSuccess;
		testNodeAttrs(node: object, method: TreeMatcherMethod): TreeMatcherTestSuccess;
		testPath(path: object[], method: TreeMatcherMethod): TreeMatcherTestSuccess;
		testAll(testNode: object, testPath: object[]): TreeMatcherTestAllSuccess;
	}
	export namespace treeRender {
		export let treeRender: TreeRender;
	}
	export let elementDefault: TreeElementAdapterDefault;
	export let elementDom: TreeElementAdapterDom;
	export let elementSnabbdom: TreeElementAdapterSnabbdom;
	export let htmlVoidTagMap: VoidTagMap;
	export class Printer {
		constructor(opt: PrinterOptions);
		printTagOpen(node: TreeElement, isSelfClose: boolean): string;
		printTagClose(node: TreeElement): string;
		printAttr(name: string, value: string): string;
		print: PrintCollection;
		printTag: PrintElement;
		printTagChildren: PrintElement;
		printText: PrintElement;
		printComment: PrintElement;
		printDeclaration: PrintElement;
		printInstruction: PrintElement;
		printAsync: PrintCollectionAsync;
		printTagAsync: PrintElementAsync;
		printTagChildrenAsync: PrintElementAsync;
		printTextAsync: PrintElementAsync;
		printCommentAsync: PrintElementAsync;
		printDeclarationAsync: PrintElementAsync;
		printInstructionAsync: PrintElementAsync;
	}
	export namespace printerTransform {
		export let printTreeSync: (opt: printTreeSyncOptions) => string;
		export let printTreeAsync: (opt: printTreeAsyncOptions) => void;
		export let async: (opt: printTransformAsyncOptions) => any;
		export let asyncMatcher: (elAdapter: TreeElementAdapter) => printTransformAsyncMatcherApi;
	}
}
