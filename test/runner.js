var fs = require('fs');
var XMLParser = require('..');
var TreeBuilder = XMLParser.TreeBuilder;
var treeStats = XMLParser.treeStats;
XMLParser = XMLParser.XMLParser;

var slice = Array.prototype.slice;
function getStateName(xp) {
	var s = xp.state;
	return s && s.name;
}
function recursivePrint(tree, max, pre) {
	var rc = tree.length;
	for (var i = 0; i < rc; i++) {
		var ri = tree[i];
		var rip = (1+i)+'/'+rc;
		if (typeof ri === 'string') {
			console.log(pre+'text '+rip, JSON.stringify(ri));
		} else if (max == 0) {
			console.log(pre+'tag '+rip, ri);
		} else {
			console.log(pre+'tag '+rip, ri.name, ri.attrs, ri.stats);
			recursivePrint(ri.children, max-1, pre+'- ');
		}
	}
}

function parseFile(fpath, callback) {

function xpEvent(ev) {
	var ar = arguments;
	var last = ar[ar.length - 1];
	var args = slice.call(ar, 1, Math.max(0, ar.length - 2));
	console.log(xp.c, xp.line, xp.column, xp.endColumn, [ev.name, last].join(':'), args);
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
	var tb = new TreeBuilder(function(ev, err, bc) {
		treeStats.apply(this, arguments);
		switch (ev) {
			case 'tagOpenStart':
			case 'tagCloseStart':
			case 'error':
				break;
			default:
				return;
				// ev = null;
		}
		bc = bc && tb.getSimpleBreadcrumb(bc);
		console.log(ev, err, tb.getSimplePath(), bc);
	});
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
		console.log('tb', err.length ? 'Errors' : 'Success', err);
		recursivePrint(tb.root.tag.children, 2, '');
		callback instanceof Function && callback();
	});
	rs.on('data', function(text) {
		xp.write(text);
	});
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

module.exports.treeBuilder = function() {
	return parseTree(__dirname+'/examples/simple.xml');
};
