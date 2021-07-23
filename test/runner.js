var fs = require('fs');
var util = require('util');
var XMLParser = require('..');
var testList = require('./testlist');
var printerTransform = require('./printertransform');
var TreeBuilder = XMLParser.TreeBuilder;
var TreeMatcher = XMLParser.TreeMatcher;
var treeStats = XMLParser.treeStats;
var treeRender = XMLParser.treeRender;
var treeWalk = XMLParser.treeWalk;
var elementDefault = XMLParser.elementDefault;
var elementSnabbdom = XMLParser.elementSnabbdom;
var Printer = XMLParser.Printer;
XMLParser = XMLParser.XMLParser;

function inspect(x) {
	return util.inspect(x, {depth: 1, colors: true});
}

function getStateName(xp) {
	var s = xp.state;
	return s && s.name;
}
function recursivePrint(tree, max, pre, elAdapter) {
	var rc = tree.length;
	for (var i = 0; i < rc; i++) {
		var ri = tree[i];
		var rip = (1+i)+'/'+rc;
		if (elAdapter.isText(ri)) {
			console.log(pre+'text '+rip, JSON.stringify(elAdapter.textValueGet(ri)));
		// } else if (max == 0) {
		// 	console.log(pre+'tag '+rip, ri);
		} else {
			var ric = elAdapter.childrenGet(ri);
			var ria = {};
			elAdapter.attrsEach(ri, (name, value) => ria[name] = value);
			console.log(pre+'tag '+rip, elAdapter.nameGet(ri), ria, ri.stats);
			if (max <= 0) {
			} else if (ric) {
				recursivePrint(ric, max-1, pre+'- ', elAdapter);
			} else {
				console.error(ri);
			}
		}
	}
}

function parseFile(fpath, callback) {

function xpEvent(ev) {
	var tag = ev.tag;
	var attr = ev.attr;
	var buf = ev.buffered;
	console.log(xp.c, xp.line, xp.column, xp.endColumn, xp.pos,
		[
			ev.name,
			ev.id,
			!tag ? '' :
			tag.selfClose ? 'selfClose' :
			tag.close ? 'close' :
			'open',
			ev.info ? [
				ev.info.strictOpenEvent ? 'sOpenEv' : '',
				ev.info.strictCloseEvent ? 'sCloseEv' : '',
			].filter(function(x) {return x;}).join(',') : '',
			buf ? [
				buf.line, buf.column, buf.endColumn, buf.pos,
			].join('.') : '',
		].join(':'),
		tag ? (
			'endInstruction' === ev.name ? tag.text :
			'endDeclaration' === ev.name ? tag.text :
			'endComment' === ev.name ? tag.textComment :
			'endCdata' === ev.name ? tag.textCdata :
			tag.name || ''
		) : ev.name === 'text' ? ev.text : '',
		attr && [attr.name, attr.value].join('=') || '',
		ev.sopen ? 'Strict «'+ev.sopen+'»' : '',
	);
}

var xp = new XMLParser(xpEvent);

// var fpath = '../examples/not-pretty.xml';
// var fpath = '../examples/test.html';
var rs = fs.createReadStream(fpath, {
	encoding: 'utf8',
	highWaterMark: 256
});

rs.on('end', function() {
	xp.end();
	console.log('finished reading '+fpath, getStateName(xp), JSON.stringify(xp.buffer));
	callback instanceof Function && callback();
});
rs.on('data', function(text) {
	xp.write(text);
});

}

function parseTree(fpath, callback) {
	function getSimpleBreadcrumb(p) {
		var el = tb.element;
		var par = p.parentScope || p.parent;
		return {
			tag: el.nameGet(p.tag),
			parentTag: par && el.nameGet(par.tag),
			parentChildren: par && el.childCount(par.tag)
		};
	}
	function getSimplePath(ev) {
		var path = ev.path;
		var list = [];
		var c = path.length;
		for (var i = 0; i < c; i++) {
			list.push(getSimpleBreadcrumb(path[i]).tag);
		}
		return list;
	}
	var elAdapter = elementDefault();
	var tb = new TreeBuilder({
		element: elAdapter,
		event: function(ev) {
			var name = ev.name;
			treeStats.call(this, ev);
			switch (name) {
				// case 'tagInit':
				case 'tagOpenStart':
				case 'tagCloseStart':
				case 'unopenedTag':
				case 'error':
					break;
				case 'unclosedTags':
				case 'tagCloseEnd':
					var tc = ev.tagClose;
					var utags = tc.unclosedTags;
					var isRoot = tc.match.parentScope === ev.builder.root;
					console.log('= '+(isRoot ? 'ROOT:' : '')+name+' ev.tagClose.index '+tc.pathIndex);
					console.log('closed tag', inspect(tc.match));
					for (var i = 0; i < utags.length; i++) {
						console.log('open tag '+i, inspect(utags[i].tag));
						// console.log('open tag parent '+i, utags[i].parentScope);
					}
					break;
				case 'info':
					console.log(name, ev.event.id, inspect(ev.tag));
				case 'text':
					console.log(name, ev.event.id, '«'+ev.text+'»');
				default:
					return;
			}
			var bc = getSimpleBreadcrumb(ev);
			console.log(name, ev.error, getSimplePath(ev), bc);
		}
	});
	tb.unclosedTagChildren = function(tag, index, ev){
		console.log('~ unclosedTag', index, getSimplePath(ev));
		console.log(tag);
		return 0;
	};
	var xp = new XMLParser(tb.parserEvent.bind(tb));
	
	// var fpath = '../examples/not-pretty.xml';
	// var fpath = '../examples/test.html';
	var rs = fs.createReadStream(fpath, {
		encoding: 'utf8',
		highWaterMark: 256
	});
	rs.on('end', function() {
		xp.end();
		console.log('finished reading '+fpath, getStateName(xp), JSON.stringify(xp.buffer));
		var err = tb.errors;
		var result = tb.root.tag;
		console.log('tb', err.length ? 'Errors' : 'Success', err);
		recursivePrint(result.children, 2, '@ ', elAdapter);
		callback instanceof Function && callback(err, result, elAdapter, tb, xp);
	});
	rs.on('data', function(text) {
		xp.write(text);
	});
}

function printTree(filePath) {
	return parseTree(filePath, function(err, result) {
		if (err.length) return;
		var printer = new Printer();
		printer.elAdapter = elementDefault();
		var out = printer.print(result.children, 0);
		console.log(out);
	});
}

function printTagPath(path, printer) {
	var pc = path.length;
	for (var i = 0; i < pc; i++) {
		path[i] = '> '+i+': '+printer.printTagOpen(path[i]);
	}
	console.log('\n'+path.join('\n')+'\n');
}

module.exports.parseFile = parseFile;
module.exports.parseTree = parseTree;

module.exports.notPrettyXmlStream = function() {
	return parseFile(__dirname+'/examples/not-pretty.xml');
};

module.exports.notPrettyXml = function() {
	return parseTree(__dirname+'/examples/not-pretty.xml');
};

module.exports.testHtml = function() {
	return parseFile(__dirname+'/examples/test.html');
};

module.exports.selfCloseStream = function() {
	return parseFile(__dirname+'/examples/self-close.xml');
};

module.exports.selfClose = function() {
	return parseTree(__dirname+'/examples/self-close.xml');
};

module.exports.commentStream = function() {
	return parseFile(__dirname+'/examples/comment.xml');
};

module.exports.treeBuilder = function() {
	return parseTree(__dirname+'/examples/simple.xml');
};

module.exports.treeConvert = function() {
	return parseTree(__dirname+'/examples/simple.xml', function(err, result) {
		if (err.length) return;
		var sourceAdapter = elementDefault();
		var targetAdapter = elementSnabbdom();
		var plugin = treeRender.adapterPluginConvertElement(targetAdapter);
		var ctx = {};
		result = treeRender.treeRenderPlugin(result.children, sourceAdapter, ctx, plugin);
		console.log('=== converted ===');
		recursivePrint(result, 2, '$ ', targetAdapter);
	});
};

module.exports.sumario = function() {
	return parseTree(__dirname+'/examples/sumario.html');
};

module.exports.printer = function() {
	return printTree(__dirname+'/examples/simple.xml');
};

module.exports.strictTag = function() {
	return printTree(__dirname+'/examples/strict-tag.html');
};

module.exports.treeSearch = function() {
	return parseTree(__dirname+'/examples/template.html', function(err, result, elAdapter) {
		if (err.length) return;
		console.log(result);
		var tm1 = TreeMatcher.fromArray([
			['html', [['lang', 'en', '<1>'], [null, null, '<0>']], []],
			['link', [['rel', 'stylesheet', '<1>'], ['href', '/css/index.css', '<1>'], [null, null, '<0>']], ['html', 'head']],
			['script', [[null, null, '<0>']], ['html', 'head']]
		], elAdapter);
		var tm2 = TreeMatcher.fromArray([
			['head', [[null, null, '<0>']], ['html']],
			['title', [[null, null, '<0>']], ['html', 'head']],
			['body', [[null, null, '<0>']], ['html']],
		], elAdapter);
		var tm3 = TreeMatcher.fromArray([
			['meta', [['charset', 'UTF-8', '<1>'], [null, null, '<0>']], ['html', 'head']],
			['meta', [['name', 'description', '<1>'], ['content', null, '<1>'], [null, null, '<0>']], ['html', 'head']],
			['div', [['id', 'root', '<1>'], [null, null, '<0>']], ['html', 'body']],
			['script', [[null, null, '<0>']], ['html', 'body']]
		], elAdapter);
		var tm4 = TreeMatcher.fromArray([
			['meta', [['name', 'viewport', '<1>'], ['content', null, '<1>'], [null, null, '<0>']], ['html', 'head']],
			['meta', [['name', 'theme-color', '<1>'], ['content', '#ffffff', '<1>'], [null, null, '<0>']], ['html', 'head']],
			['script', [['src', '/js/index.js', '<1>'], [null, null, '<0>']], ['html', 'body']],
		], elAdapter);
		var printer = new Printer({elAdapter: elAdapter});
		treeWalk(result, elAdapter, {
			onNode: function(node, path) {
				var test, match = 'not-found';
				path = path.slice(1);
				switch (undefined) {
					default:
					test = tm1.testNodeSub(node, path);
					if (test.success) {
						match = 'tm1';
						break;
					}
					test = tm2.testNodeSub(node, path);
					if (test.success) {
						match = 'tm2';
						break;
					}
					test = tm3.testNodeSub(node, path);
					if (test.success) {
						match = 'tm3';
						break;
					}
					test = tm4.testNodeSub(node, path);
					if (test.success) {
						match = 'tm4';
						break;
					}
					// test = undefined;
				}
				printTagPath(path.concat([node]), printer);
				console.log(match, util.inspect(test, {depth: 3, colors: true}));
			}
		})
	});
}

module.exports.testList = testList;
module.exports.printerTransform = printerTransform;
