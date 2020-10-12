var fs = require('fs');
var path = require('path');
var XMLParser = require('..');
var printerTransform = XMLParser.printerTransform;
var Printer = XMLParser.Printer;
var TreeMatcher = XMLParser.TreeMatcher;
var getParser = XMLParser.getParser;

var fileOpt = { encoding: 'utf8' };

var printer, tmAppRoot, tmHead, tmJsIndex, tmDocTitle, tmDocDesc;

function transformAsync(tree, elAdapter, callback) {
	printerTransform.async({
		tree, elAdapter, transform, callback
	});
}

function buildCssLink(path, elAdapter) {
	var link = elAdapter.initName('link');
	elAdapter.attrsAdd(link, {name: 'rel', value: 'stylesheet'});
	elAdapter.attrsAdd(link, {name: 'href', value: path });
	return link;
}

function buildCssLinks(elAdapter) {
	var links = elAdapter.initRoot();
	elAdapter.childElement(links, buildCssLink('/css/style-0.css', elAdapter));
	elAdapter.childElement(links, buildCssLink('/css/style-1.css', elAdapter));
	elAdapter.childElement(links, buildCssLink('/css/style-2.css', elAdapter));
	return elAdapter.childrenGet(links);
}

function buildScriptSrc(path, elAdapter) {
	var link = elAdapter.initName('script');
	elAdapter.attrsAdd(link, {name: 'src', value: path });
	return link;
}

function buildCompScripts(opt) {
	var elAdapter = opt.elAdapter;
	var scripts = elAdapter.initRoot();
	var globalVar = '_app$';
	var indent = opt.printer.printIndent(opt.level);
	var render = '';
	elAdapter.childElement(scripts, buildScriptSrc('/comp/comp-0.js', elAdapter));
	render += '\n\tassembleComponent(' +
		JSON.stringify('Comp') + ', ' +
		JSON.stringify('comp-0') +', function() {' +
		'return "compiled"' + ';});\n';
	elAdapter.childElement(scripts, buildScriptSrc('/comp/comp-1.js', elAdapter));
	render += '\n\tassembleComponent(' +
		JSON.stringify('Comp') + ', ' +
		JSON.stringify('comp-1') +', function() {' +
		'return "compiled"' + ';});\n';
	elAdapter.childElement(scripts, buildScriptSrc('/comp/comp-2.js', elAdapter));
	render += '\n\tassembleComponent(' +
		JSON.stringify('Comp') + ', ' +
		JSON.stringify('comp-2') +', function() {' +
		'return "compiled"' + ';});\n';
	render += '\n\tglobal.services.initialState = ' +
		JSON.stringify({state: {}}) + ';\n';
	scripts = opt.printer.print(elAdapter.childrenGet(scripts), opt.level, opt.path);
	render = '\
!function(global) {\n\
	function assembleComponent(croot, cpath, getRender) {\n\
		const cdef = deferredPromise([croot, cpath].join(\'::\'));\n\
		const gc = global[croot];\n\
		const comp = gc.map[cpath];\n\
		comp.render = getRender();\n\
		gc.mapCache[cpath] = cdef.promise;\n\
		cdef.resolve(comp);\n\
	}\n\
' + render + '\n\
}(' + globalVar + ');';
	return scripts + '\
' + indent + '<script>\n\
' + render + '\n\
' + indent + '</script>\n';
}

function nodeContentAsTree(content, opt) {
	var elAdapter = opt.elAdapter;
	var frag = elAdapter.initRoot();
	elAdapter.attrsEach(opt.node, function(name) {
		if ('content' === name) return this._remove;
	});
	elAdapter.attrsAdd(opt.node, { name: 'content', value: content });
	elAdapter.childElement(frag, opt.node);
	return elAdapter.childrenGet(frag);
}

function transform(opt) {
	var node = opt.node;
	var path = opt.path;
	var elAdapter = opt.elAdapter;
	var cbTransform = opt.callback;
	var tmResult;
	printTagPath(path.concat(node));

	tmResult = tmAppRoot.testAll(node, path);
	if (tmResult.success) {
		console.log(tmResult);
		return cbTransform(null, {
			name: 'comp html',
			noFormat: true,
			children: {text: '<div class="app--root">App</div>', noFormat: true}
		});
	}

	tmResult = tmHead.testAll(node, path);
	if (tmResult.success) {
		console.log(tmResult);
		return cbTransform(null, {
			name: 'css links',
			append: {tree: buildCssLinks(elAdapter)}
		});
	}

	tmResult = tmJsIndex.testAll(node, path);
	if (tmResult.success) {
		console.log(tmResult);
		return cbTransform(null, {
			name: 'comp scripts',
			after: {text: buildCompScripts(opt), noFormat: true}
		});
	}

	tmResult = tmDocTitle.testAll(node, path);
	if (tmResult.success) {
		console.log(tmResult);
		return cbTransform(null, {
			name: 'document title',
			noFormat: true,
			children: {text: 'Replaced Title', noFormat: true}
		});
	}

	tmResult = tmDocDesc.testAll(node, path);
	if (tmResult.success) {
		console.log(tmResult);
		return cbTransform(null, {
			name: 'document description',
			full: {tree: nodeContentAsTree('Replaced Description from PrinterTransform', opt)}
		});
	}
	// var tma = tmResult && tmResult.attr;
	// if (tma && tma.rules) {
	// 	console.log(tma.rules);
	// }
	cbTransform();
}

function printTagPath(path) {
	var pc = path.length;
	for (var i = 0; i < pc; i++) {
		path[i] = '> '+i+': '+printer.printTagOpen(path[i]);
	}
	console.log('\n'+path.join('\n')+'\n');
}

module.exports = function testPrinterTransform() {
	var fpath = path.resolve(__dirname, 'examples/template.html');
	fs.readFile(fpath, fileOpt, function(err, html) {
		if (err) return console.error(err);
		var parser = getParser();
		parser.end(html);
		html = parser.getResult();
		err = html.err;
		if (err) return console.error(err);
		printer = new Printer();
		printer.elAdapter = html.elAdapter;
		tmAppRoot = TreeMatcher.from({
			name: 'div',
			attrs: [['id', 'root'], [null, null, '<0>']],
			path: ['html', 'body']
		}, html.elAdapter);
		tmHead = TreeMatcher.from({
			name: 'head',
			path: ['html']
		}, html.elAdapter);
		tmJsIndex = TreeMatcher.from({
			name: 'script',
			attrs: [['src', '/js/index.js'], [null, null, '<0>']],
			path: ['html', 'body']
		}, html.elAdapter);
		tmDocTitle = TreeMatcher.from({
			name: 'title',
			attrs: [[null, null, '<0>']],
			path: ['html', 'head']
		}, html.elAdapter);
		tmDocDesc = TreeMatcher.from({
			name: 'meta',
			attrs: [['name', 'description'], ['content', null], [null, null, '<0>']],
			path: ['html', 'head']
		}, html.elAdapter);
		transformAsync(html.tree, html.elAdapter, function(err, html) {
			console.log(err, html);
		});
	});
};
