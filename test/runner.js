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
				ev = null;
		}
		if (ev) {
			bc = bc && tb.getSimpleBreadcrumb(bc);
			console.log(ev, err, tb.getSimplePath(), bc);
		}
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
		var root = tb.root;
		var rc = root.length;
		for (var i = 0; i < rc; i++) {
			var ri = root[i];
			console.log('tb', typeof ri === 'string' ? JSON.stringify(ri) : ri);
		}
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
