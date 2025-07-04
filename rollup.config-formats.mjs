import path from 'path';
// import resolve from 'rollup-plugin-node-resolve';
// import commonjs from 'rollup-plugin-commonjs';
// import { uglify } from 'rollup-plugin-uglify';
import terser from "@rollup/plugin-terser";
import buble from '@rollup/plugin-buble';
import inject from '@rollup/plugin-inject';
import pkg from './package.json' with { type: 'json' };

function beforeExt(name, add) {
	var i = name.lastIndexOf('.');
	return i === -1
		? name+add
		: name.substr(0, i).concat(add, name.substr(i));
}

export default function getFormats(opt) {

const noMinify = opt && opt.noMinify;

function format(opt, plugin) {
	if (!(opt.plugins instanceof Array)) opt.plugins = [];
	opt.plugins.unshift(inject({
		'_ObjectAssign': path.resolve('polyfill/object-assign.mjs')
	}));
	opt.plugins.unshift(buble({
		objectAssign: '_ObjectAssign',
		transforms: {
			dangerousForOf: true,
			...(opt.transforms || {})
		}
	}));
	list.push(opt);
	if (!noMinify) {
		var min = Object.assign({}, opt);
		min.output = Object.assign({}, min.output);
		min.output.file = beforeExt(min.output.file, '.min');
		min.plugins = (min.plugins || []).concat([plugin || terser()]);
		list.push(min);
	}
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
});
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

return list;

}
