// import resolve from 'rollup-plugin-node-resolve';
// import commonjs from 'rollup-plugin-commonjs';
import { uglify } from 'rollup-plugin-uglify';
import minify from 'rollup-plugin-babel-minify';
import pkg from './package.json';

function beforeExt(name, add) {
	var i = name.lastIndexOf('.');
	return i === -1
		? name+add
		: name.substr(0, i).concat(add, name.substr(i));
}

function format(opt, plugin) {
	var min = Object.assign({}, opt);
	min.output = Object.assign({}, min.output);
	min.output.file = beforeExt(min.output.file, '.min');
	min.plugins = (min.plugins || []).concat([plugin || uglify()]);
	list.push(opt);
	// list.push(min);
}

var list = [];

format({
	input: 'src/index.mjs',
	output: {
		name: pkg.export_var,
		file: pkg.browser,
		format: 'iife',
		indent: ''
	}
});
format({
	input: 'src/index.mjs',
	output: {
		name: pkg.export_var,
		file: pkg.main,
		format: 'cjs',
		indent: ''
	}
});
format({
	input: 'src/index.mjs',
	output: {
		name: pkg.export_var,
		file: pkg.module,
		format: 'esm',
		indent: ''
	}
}, minify({
	comments: false,
	sourceMap: false
}));
format({
	input: 'src/index.mjs',
	output: {
		amd: {id: pkg.export_amd},
		name: pkg.export_var,
		file: pkg.module_amd,
		format: 'amd',
		indent: ''
	}
});

export default list;
