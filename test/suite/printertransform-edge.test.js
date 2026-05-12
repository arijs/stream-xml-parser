import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getParser, printerTransform, Printer, TreeMatcher, getFullTreePath } from '../../src/index.mjs';
import { get } from 'node:http';
function nodeAndPath(root, targetName, elAdapter) {
	const { node: nodeEntry, path: ancestorPath } = getFullTreePath(root, ({ node: n }) => elAdapter.nameGet(n) === targetName, elAdapter);
	if (!nodeEntry) {
		return { node: null, path: null, fullPath: null };
	}
	const node = nodeEntry.node;
	const fullPath = [...ancestorPath, nodeEntry];
	return { node, nodeEntry, path: ancestorPath, fullPath };
}


function parse(html) {
	const p = getParser();
	p.end(html);
	return p.getResult();
}

const htmlSource = `<html lang="en" style-modified="boxSizing: border-box;" style-stats="in-len: 11918; out-len: 22; in-props: 515; out-props: 1;">
	<body style-modified="backgroundColor: rgb(255, 255, 255);" style-stats-nomatch="in-len: 12206; out-len: 310; in-props: 515; out-props: 10;">
		<div id="root" style-modified-nomatch="boxSizing: border-box;" style-stats="in-len: 12205; out-len: 22; in-props: 515; out-props: 1;">
			<div class="bd-example container-fluid" style-modified-nomatch="boxSizing: border-box;" style-stats-nomatch="in-len: 12213; out-len: 110; in-props: 515; out-props: 6;">
				<form class="row g-3" style-modified="boxSizing: border-box;" style-stats="in-len: 12227; out-len: 52; in-props: 515; out-props: 3;">
						<label for="validationServerUsername" class="form-label" style-modified="boxSizing: border-box;" style-stats-nomatch="in-len: 12234; out-len: 64; in-props: 515; out-props: 3;">
							Username
						</label>
						<div class="input-group has-validation is-invalid" style-modified-nomatch="alignItems: stretch;" style-stats="in-len: 12194; out-len: 108; in-props: 515; out-props: 6;">
							<span class="input-group-text" id="inputGroupPrepend3" style-modified-nomatch="alignItems: center;" style-stats-nomatch="in-len: 12358; out-len: 318; in-props: 515; out-props: 13;">
								@
							</span>
							<input type="text" class="form-control is-invalid" id="validationServerUsername" aria-describedby="inputGroupPrepend3" required="" style-modified="appearance: none;" style-stats="in-len: 13468; out-len: 557; in-props: 517; out-props: 16;" />
						</div>
						<div class="invalid-feedback" style-modified="boxSizing: border-box; color:" style-stats-nomatch="in-len: 12246; out-len: 109; in-props: 515; out-props: 6;">
							Please choose a username.
						</div>
					</div>
					<div class="col-md-6" style-modified-nomatch="boxSizing: border-box; flex: 0 0 auto; width: 352px;" style-stats="in-len: 12227; out-len: 52; in-props: 515; out-props: 3;">
						<label for="validationServer03" class="form-label" style-modified-nomatch="boxSizing: border-box;" style-stats-nomatch="in-len: 12236; out-len: 64; in-props: 515; out-props: 3;">
							City
						</label>
						<input type="text" class="form-control is-invalid" id="validationServer03" required="" style-modified="appearance: none;" style-stats="in-len: 13471; out-len: 541; in-props: 517; out-props: 16;" />
						<div class="invalid-feedback" style-modified="boxSizing: border-box; color:" style-stats-nomatch="in-len: 12246; out-len: 109; in-props: 515; out-props: 6;">
							Please provide a valid city.
						</div>
					</div>
				</form>
			</div>
		</div>
	</body>
</html>
<!--
		in-len: 185673; out-len: 2546; in-props: 7729; out-props: 99; -->

`;

describe('printerTransform Edge cases', () => {
	it('throws Maximum call stack size exceeded when returning a new tree that matches the same rule', () => {
		const { tree, elAdapter } = parse(htmlSource);
		const styleModifiedList = [];
		const styleStatsList = [];
		const printer = new Printer();
		const sm = printerTransform.syncMatcher(elAdapter);
		sm.addRule({
			matcher: {
				attrs: [['style-modified', null, '<1>']],
			},
			callback: function(entry) {
				styleModifiedList.push(entry);
				return {
					full: { tree: [entry.node.node], noFormat: true },
					noFormat: true,
				}
			},
		});
		sm.addRule({
			matcher: {
				attrs: [['style-stats', null, '<1>']],
			},
			callback: function(entry) {
				styleStatsList.push(entry);
				return {
					full: { tree: [entry.node.node], noFormat: true },
					noFormat: true,
				}
			},
		});
		// The user must be aware here that if he has a matcher and returns a new replacement
		// tree that has nodes that also match the same matcher, then the transform will be
		// called again, which will cause an infinite loop if the transform always returns a
		// new tree. To prevent this, the user can provide a different printer instance that
		// does not have the `printTag` method overridden by the transform, so that the
		// transform won't be called again for the new tree.
		assert.throws(() => {
			const result = printerTransform.sync({
				tree, elAdapter, printer, transform: sm.transform,
			});
			// transformSync(tree, elAdapter, sm.transform);
			assert.equal(result.errors, null);
			assert.equal(styleModifiedList.length, 14);
			assert.equal(styleStatsList.length, 14);
		}, {
			name: 'RangeError',
			message: 'Maximum call stack size exceeded',
		});
	});

	it('allows the user to provide a different printer instance to prevent infinite loops (further rules won\'t match on the replacement tree top level, but they will on nested levels)', () => {
		const { tree, elAdapter } = parse(htmlSource);
		const styleModifiedList = [];
		const styleStatsList = [];
		// printerTransform by default patches the `printTag` method of the printer instance
		// passed to it, so we create a separate printer instance for the transform replacement
		// to use, so that when the transform returns a new tree that matches the same rule,
		// it won't cause an infinite loop.
		const transformPrinter = new Printer();
		const dontTransformRootLevelPrinter = new Printer();
		dontTransformRootLevelPrinter.printTagChildren = function() {
			return transformPrinter.printTagChildren.apply(transformPrinter, arguments);
		};
		const sm = printerTransform.syncMatcher(elAdapter);
		sm.addRule({
			matcher: {
				attrs: [['style-modified', null, '<1>']],
			},
			callback: function(entry) {
				styleModifiedList.push(entry);
				return {
					full: { tree: [entry.node.node], noFormat: true, printer: dontTransformRootLevelPrinter },
					noFormat: true,
				}
			},
		});
		sm.addRule({
			matcher: {
				attrs: [['style-stats', null, '<1>']],
			},
			callback: function(entry) {
				styleStatsList.push(entry);
				return {
					full: { tree: [entry.node.node], noFormat: true, printer: dontTransformRootLevelPrinter },
					noFormat: true,
				}
			},
		});
		// The user must be aware here that if he has a matcher and returns a new replacement
		// tree that has nodes that also match the same matcher, then the transform will be
		// called again, which will cause an infinite loop if the transform always returns a
		// new tree. To prevent this, the user can provide a different printer instance that
		// does not have the `printTag` method overridden by the transform, so that the
		// transform won't be called again for the new tree.
		const result = printerTransform.sync({
			tree, elAdapter, printer: transformPrinter, transform: sm.transform,
		});
		// transformSync(tree, elAdapter, sm.transform);
		assert.equal(result.errors, null);
		assert.equal(styleModifiedList.length, 8);
		// The stats list will return three items because the transform won't be called again
		// for the new tree returned by the callback, because the new tree will be printed
		// using the dontTransformRootLevelPrinter instance that does not have the `printTag` method
		// overridden by the transform, so the transform won't be called again for the new tree
		// in the root level, only from its children onwards.
		// But three nodes are not matched by the 'style-modified' rule because they have the
		// 'style-modified-nomatch' attribute instead of the 'style-modified' attribute, so they
		// won't be transformed by the first rule, and thus they will still match the second rule
		// and be included in the stats list.
		assert.equal(styleStatsList.length, 3);
	});

	it('allows the user to provide a different printer instance to prevent infinite loops (combine matchers in a single rule then test them separately to get the correct count)', () => {
		const { tree, elAdapter } = parse(htmlSource);
		const styleModifiedList = [];
		const styleStatsList = [];
		// printerTransform by default patches the `printTag` method of the printer instance
		// passed to it, so we create a separate printer instance for the transform replacement
		// to use, so that when the transform returns a new tree that matches the same rule,
		// it won't cause an infinite loop.
		const transformPrinter = new Printer();
		const dontTransformRootLevelPrinter = new Printer();
		dontTransformRootLevelPrinter.printTagChildren = function() {
			return transformPrinter.printTagChildren.apply(transformPrinter, arguments);
		};
		const sm = printerTransform.syncMatcher(elAdapter);
		const matcherStyleModified = TreeMatcher.from({
			attrs: [['style-modified', null, '<1>']],
		}, elAdapter);
		const matcherStyleStats = TreeMatcher.from({
			attrs: [['style-stats', null, '<1>']],
		}, elAdapter);
		sm.addRule({
			matcher: TreeMatcher.fromArray([matcherStyleModified, matcherStyleStats], elAdapter),
			callback: function(entry) {
				const { node, path } = entry;
				if (matcherStyleModified.testAll(node, path)) {
					styleModifiedList.push(entry);
				}
				if (matcherStyleStats.testAll(node, path)) {
					styleStatsList.push(entry);
				}
				return {
					full: { tree: [node.node], noFormat: true, printer: dontTransformRootLevelPrinter },
					noFormat: true,
				}
			},
		});
		// The user must be aware here that if he has a matcher and returns a new replacement
		// tree that has nodes that also match the same matcher, then the transform will be
		// called again, which will cause an infinite loop if the transform always returns a
		// new tree. To prevent this, the user can provide a different printer instance that
		// does not have the `printTag` method overridden by the transform, so that the
		// transform won't be called again for the new tree.
		const result = printerTransform.sync({
			tree, elAdapter, printer: transformPrinter, transform: sm.transform,
		});
		// transformSync(tree, elAdapter, sm.transform);
		assert.equal(result.errors, null);
		assert.equal(styleModifiedList.length, 11);
		// The stats list will return all items because we're using a single rule for both
		// matchers, so the callback will be called for all nodes that match either of the
		// matchers, and inside the callback we test each matcher separately and push to the
		// corresponding list, so all nodes that match the 'style-stats' matcher will be
		// included in the stats list regardless of whether they also match the 'style-modified'
		// matcher or not.
		assert.equal(styleStatsList.length, 11);
	});
});
