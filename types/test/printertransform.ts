// Minimum TypeScript Version: 4.0
import fs from 'fs';
import path from 'path';
import {
	printerTransform,
	Printer,
	getParser
} from '../../src/index';

var fileOpt = { encoding: 'utf8' };

var printer;

function transformAsync(tree, elAdapter, transform, callback) {
	return printerTransform.async({
		tree, elAdapter, transform, level: -1, callback
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
		var elAdapter = html.elAdapter;
		printer = new Printer();
		printer.elAdapter = elAdapter;

		var am = printerTransform.asyncMatcher(elAdapter);
		am.onTest = function(opt) {
			printTagPath(opt.path.concat(opt.node));
		};
		am.onTestRule = function(result, success) {
			if (success) console.log(result);
		};
		am.addRule({
			matcher: {
				name: ['div'],
				attrs: [['id', 'root'], [null, null, '<0>']],
				path: [['html', 'body']]
			},
			callback: function(opt) {
				return opt.callback(null, {
					name: 'comp html',
					noFormat: true,
					children: {text: '<div class="app--root">App</div>', noFormat: true}
				});
			}
		});
		am.addRule({
			matcher: {
				name: ['head'],
				path: [['html']]
			},
			callback: function(opt) {
				return opt.callback(null, {
					name: 'css links',
					append: {tree: buildCssLinks(elAdapter)}
				});
			}
		});
		am.addRule({
			matcher: {
				name: ['script'],
				attrs: [['src', '/js/index.js'], [null, null, '<0>']],
				path: [['html', 'body']]
			},
			callback: function(opt) {
				return opt.callback(null, {
					name: 'comp scripts',
					after: {text: buildCompScripts(opt), noFormat: true}
				});
			}
		});
		am.addRule({
			matcher: {
				name: ['title'],
				attrs: [[null, null, '<0>']],
				path: [['html', 'head']]
			},
			callback: function(opt) {
				return opt.callback(null, {
					name: 'document title',
					noFormat: true,
					children: {text: 'Replaced Title', noFormat: true}
				});
			}
		});
		am.addRule({
			matcher: {
				name: ['meta'],
				attrs: [['name', 'description'], ['content', null], [null, null, '<0>']],
				path: [['html', 'head']]
			},
			callback: function(opt) {
				return opt.callback(null, {
					name: 'document description',
					full: {tree: nodeContentAsTree('Replaced Description from PrinterTransform', opt)}
				});
			}
		});

		transformAsync(html.tree, elAdapter, am.transform, function(err, html) {
			console.log(err, html);
		});
	});
};
