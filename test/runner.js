var fs = require('fs');
var XMLParser = require('..');

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

module.exports = parseFile;

module.exports.notPrettyXml = function() {
	return parseFile(__dirname+'/examples/not-pretty.xml');
};

module.exports.testHtml = function() {
	return parseFile(__dirname+'/examples/test.html');
};
