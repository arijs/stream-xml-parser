// import { loadAjaxPromise } from "@arijs/frontend/src/client/loaders/ajax.mjs"
// import getParser from "@arijs/stream-xml-parser/src/getparser.mjs"
// import treeWalk from "@arijs/stream-xml-parser/src/treewalk.mjs"
// import TreeMatcher from "@arijs/stream-xml-parser/src/treematcher.mjs"
import { loadAjaxPromise } from "https://unpkg.com/@arijs/frontend/src/client/loaders/ajax.mjs"
import {
	getParser,
	TreeMatcher,
	treeWalk,
} from "https://unpkg.com/@arijs/stream-xml-parser@0.2.10/dist/arijs-stream-xml-parser.esm.min.js"

let html = ''

const load = () => loadAjaxPromise({
	url: 'https://enable-cors.org/',
}).then(({data}) => {
	//console.log(data)
	html = data
})

const getResult = () => {
	const parser = getParser()
	parser.end(html)
	const {tree, elAdapter} = parser.getResult({ asNode: true })
	const tm1 = TreeMatcher.from([
		'h2',
		[[null, null, '<0>']],
		[
			'*', // document-fragment
			'html',
			'* <+?>',
			['div', [
				['class', /\brow-fluid\b/],
				[null, null, '<0>'],
			]],
			['div', [
				['class', /\bspan4\b/],
				[null, null, '<0>'],
			]],
		]
	], elAdapter)
	const found = []
	treeWalk(tree, elAdapter, {
		onNode(node, path) {
			const res = tm1.testAll(node, path)
			if (res.success) {
				//found.push(node)
				let ntext = ''
				treeWalk(node, elAdapter, {
					onText(tnode) {
						ntext += elAdapter.textValueGet(tnode)
					}
				})
				found.push(ntext)
			}
		}
	})
	return { found, html }
}

const display = ({ found, html }, el) => {
	const pre = document.createElement('pre')
	const tn = document.createTextNode(
		JSON.stringify(found, null, 2)
	)
	pre.append(tn)
	const pre2 = document.createElement('pre')
	const tn2 = document.createTextNode(
		html
	)
	pre2.append(tn2)
	el || (el = document.querySelector("body"))
	el.append(pre, pre2)
}

const run = (el) => display(getResult(), el)

window.testTreeMatcher = {
	load,
	getResult,
	display,
	run,
}
