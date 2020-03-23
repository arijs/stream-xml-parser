# @AriJS / StreamXMLParser

## Testing

```
$ npm run test -- notPrettyXmlStream

$ npm run test -- notPrettyXml

$ npm run test -- testHtml

$ npm run test -- selfClose

$ npm run test -- treeBuilder
```

## Snabbdom

Parse a HTML string to a tree of VNodes
and use Snabbdom to patch a DOM element

```javascript
// Note below that you need to provide functions
// to decode and encode html entities
// (ex: < to &lt;, " to &quot;, etc)

function elGetHtml (el) {
	var t = String(el.tagName).toLowerCase();
	var a = '';
	var ea = el.attributes;
	var eac = ea.length;
	for (var i = 0; i < eac; i++) {
		var eai = ea[i];
		// ↓ provide your encode function ↓
		var ean = htmlEntitiesEncode(eai.name);
		var eav = htmlEntitiesEncode(eai.value);
		a += ' '+ean+'='+JSON.stringify(eav);
	}
	var sc = StreamXMLParser.htmlVoidTagMap[t];
	return {
		open: '<'+t+a+(sc?'/':'')+'>',
		close: sc ? '' : '</'+t+'>'
	};
}

function htmlToVnodes (html) {
	var tb = new StreamXMLParser.TreeBuilder({
		element: StreamXMLParser.elementSnabbdom()
	});
	var xp = new StreamXMLParser.XMLParser({
		event: tb.parserEvent.bind(tb),
		// ↓ provide your decode function ↓
		decodeString: htmlEntitiesDecode
	});
	xp.end(html);
	return tb.root.tag.children;
}

function patchElHtml (el, html) {
	var patch = snabbdom.init([
		require('snabbdom/modules/attrs').default
	]);
	var outer = elGetHtml(el);
	html = outer.open+html+outer.close;
	html = htmlToVnodes(html);
	el = snabbdom.toVNode(el);
	patch(el, html[0]);
}

// How to use:
patchElHtml(your_element, your_html_string);
```

## HTML to PDF with Leerraum.js and jsPDF

[Leerraum.js](https://github.com/pkamenarsky/leerraum.js)

[jsPDF](https://github.com/MrRio/jsPDF)

```javascript
var mmPerInch = 25.4;
var pointsPerInch = 72;
var pointsPerMm = pointsPerInch / mmPerInch;
var mmPerPoints = mmPerInch / pointsPerInch;
var pageWidth = 210; // A4 paper
var pageHeight = 297;

function renderNode(doc, node, lineX, lineY) {
	var span = node.span;
	var font = span.fontFamily.split('\t');
	doc.setFont(font[0]);
	doc.setFontStyle(font[1] || "normal");
	doc.setFontSize(span.fontSize);
	doc.text(node.text, node.x * mmPerPoints + lineX, lineY);
}

function htmlToParagraphs(html, rootStyle) {
	var ht = new StreamXMLParser.HTMLTypeset();
	var tb = new StreamXMLParser.TreeBuilder(ht.treeEvent);
	var xp = new StreamXMLParser.XMLParser({
		event: tb.parserEvent
		// ↓ provide your decode function ↓
		decodeString: htmlEntitiesDecode
	});
	Object.assign(ht.rootStyle, rootStyle);
	xp.end(html);
	return ht;
}

function renderHtmlColumnsToPdf(html, rootStyle)
	var ht = new StreamXMLParser.HTMLTypeset();
	var rootStyle = ht.rootStyle;
	rootStyle.fontSize = 8;
	rootStyle.lineLeading = 10;
	rootStyle.paragraphLeading = 6;
	var tb = new StreamXMLParser.TreeBuilder(ht.treeEvent);
	var xp = new StreamXMLParser.XMLParser({
		event: tb.parserEvent
		// ↓ provide your decode function ↓
		decodeString: htmlEntitiesDecode
	});
	xp.end(this.sumarioExecutivo);
	ht = ht.getResult();
	var measures = Leerraum.jsPdfDocMeasures(doc);
	var colNum = 3;
	var colGap = 2;
	var colTop = 10;
	var colLeft = 10;
	var colWidth = 62;
	var colHeight = pageHeight - (colTop * 2);
	var firstPageOffset = 12;
	var lineHeight = rootStyle.lineLeading * mmPerPoints;
	var parMargin = rootStyle.paragraphLeading * mmPerPoints;
	var parsLines = Leerraum.paragraphsToTextNodes(measures, ht.result, function() {
		return colWidth * pointsPerMm;
	});
	var getPageHeight = function (page) {
		// page number starting from zero on the first page,
		// content has less space because of space reserved
		// for a title on the page.
		// This function can return a custom height for each page.
		return page ? colHeight : colHeight - firstPageOffset;
	};
	var getPageTop = function (page) {
		return colTop + (page ? 0 : firstPageOffset);
	};
	var pagesCols = Leerraum.columns.paragraphsToPageColumns(parsLines, getPageHeight, colNum, lineHeight, parMargin);
	var pageCols;
	var pageIndex = 0;
	while (pageCols = pagesCols.shift()) {
		var colPars = null;
		var x = colLeft;
		var y = getPageTop(pageIndex);
		while (colPars = pageCols.shift()) {
			var parLines;
			while (parLines = colPars.shift()) {
				var lineWords;
				while (lineWords = parLines.shift()) {
					var word;
					while (word = lineWords.shift()) {
						renderNode(doc, word, x, y + 1);
					}
					y += lineHeight;
				}
				y += parMargin;
			}
			x += colWidth + colGap;
			y = getPageTop(pageIndex);
		}
		if (pagesCols.length) {
			doc.addPage('a4', 'p');
			this.createPDFBackground(doc, cs);
			pageIndex++;
		}
	}
}
```

## License

[MIT](LICENSE).
