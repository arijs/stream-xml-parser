import Printer from './printer';
import getParser from './getparser';
import TreeMatcher from './treematcher';

export function printTreeSync({tree, elAdapter, customPrintTag, path, level}) {
	var printer = new Printer();
	printer.elAdapter = elAdapter;
	if (customPrintTag instanceof Function) {
		var defaultPrintTag = printer.printTag.bind(printer);
		printer.printTag = function(node, level, path) {
			return customPrintTag(node, level, path, defaultPrintTag, printer);
		};
	}
	return printer.print(tree, level || 0, path);
}

export function printTreeAsync({tree, elAdapter, customPrintTag, path, level, callback}) {
	var printer = new Printer();
	printer.elAdapter = elAdapter;
	if (customPrintTag instanceof Function) {
		var defaultPrintTag = printer.printTagAsync.bind(printer);
		printer.printTagAsync = function(node, level, path, cbTag) {
			return customPrintTag(node, level, path, defaultPrintTag, printer, cbTag);
		};
	}
	return printer.printAsync(tree, level || 0, path, callback);
}

function parseString(str, elAdapter) {
	var parser = getParser(elAdapter);
	parser.write(str);
	parser.end();
	return parser.getResult();
}

export function prepare(rep, level, path, elAdapter, transformName) {
	var {name, tree, text, noFormat} = rep;
	var error;
	if (null == tree && !noFormat) {
		rep = parseString(String(text || ''), elAdapter);
		({tree, error} = rep);
		if (error) {
			error = { name: name || transformName, error };
		}
	}
	if (null != tree) {
		level = null == rep.indent ? level :
			+rep.indent === rep.indent ? rep.indent :
			rep.indent instanceof Function ? rep.indent(level) :
			level;
		text = printTreeSync({tree, elAdapter, path, level});
	} else if (!noFormat) {
		text =
			printer.printIndent(level) +
			text +
			printer.newLine;
	}
	return {error, text};
}

export function apply(rep, level, path, elAdapter) {
	var errors = [], text;
	if (
		null != rep.full ||
		null != rep.fullSrc
	) {
		text = prepareRep( rep.before ) +
			( rep.full
				? prepareRep( rep.full )
				: rep.fullSrc || ''
			) +
			prepareRep( rep.after );
	} else {
		text =
			prepareRep( rep.before ) +
			rep.open + 
			prepareRep( rep.prepend, 1 ) +
			( rep.children
				? prepareRep( rep.children, 1 )
				: rep.childrenSrc || ''
			) +
			prepareRep( rep.append, 1 ) +
			rep.close +
			prepareRep( rep.after );
	}
	return {errors, text};
	function prepareRep(trep, add) {
		if (trep) {
			trep = prepare(trep, level + (add || 0), path, elAdapter, rep.name);
			if (trep.error) errors.push(trep.error);
			return String(trep.text || '');
		} else {
			return '';
		}
	}
}

export function async({tree, elAdapter, transform, callback, level}) {
	var repErrors = [];
	return printTreeAsync({tree, elAdapter, customPrintTag, level, callback: cbPrintTree});
	function addErrors(err) {
		if (err instanceof Array) {
			repErrors = repErrors.concat(err);
		} else if (err) {
			repErrors.push(err);
		}
	}
	function cbPrintTree(err, page) {
		addErrors(err);
		if (!repErrors.length) repErrors = null;
		callback(repErrors, page);
	}
	function customPrintTag(node, level, path, printTagAsync, printer, cbTag) {
		return transform({node, path, level, elAdapter, printer, callback: cbTransform});
		function cbTransform(err, rep) {
			if (rep) {
				addErrors(err);
				if (
					null == rep.full && (
					null != rep.append ||
					null != rep.prepend ||
					null != rep.children )
				) {
					rep.open =
						printer.printIndent(level) +
						printer.printTagOpen(node) +
						( null == rep.children || !rep.noFormat ? printer.newLine : '' );
					rep.close = 
						( null == rep.children || !rep.noFormat ? printer.printIndent(level) : '' ) +
						printer.printTagClose(node) +
						printer.newLine;
					if (null == rep.children) {
						return printer.printTagChildrenAsync(node, level+1, path.concat([node]), function(errPrint, nodeChildren) {
							addErrors(errPrint);
							rep.childrenSrc = nodeChildren;
							return withContainer(rep);
						});
					} else {
						return withContainer(rep);
					}
				} else if (
					null == rep.full
				) {
					return printTagAsync(node, level, path, function (errPrint, nodeFull) {
						addErrors(errPrint);
						rep.fullSrc = nodeFull;
						return withContainer(rep);
					});
				}
				return withContainer(rep);
			} else if (err) {
				return cbTag(err, '');
			} else {
				return printTagAsync(node, level, path, cbTag);
			}
		}
		function withContainer(rep) {
			var {errors, text} = apply(rep, level, path, elAdapter);
			addErrors(errors);
			cbTag(null, text);
		}
	}
}

export function asyncMatcher(elAdapter) {
	var rules = [];
	var api = {
		addRule: function(opt) {
			opt.matcher = TreeMatcher.from(opt.matcher, elAdapter, opt.opt);
			rules.push(opt);
		},
		clear: function() {
			rules = [];
		},
		onTest: function() {},
		onTestRule: function() {},
		isSuccess: function(result) {
			return result.success;
		},
		transform: function(opt) {
			var node = opt.node;
			var path = opt.path;
			var rc = rules.length;
			api.onTest(opt);
			for (var i = 0; i < rc; i++) {
				var isSuccess = rules[i].isSuccess || api.isSuccess;
				var result = rules[i].matcher.testAll(node, path);
				var success = isSuccess(result);
				api.onTestRule(result, success, rules[i]);
				if (success) {
					return rules[i].callback(opt);
				}
			}
			opt.callback();
		}
	};
	return api;
}
