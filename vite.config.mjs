import { defineConfig } from 'vite';

const externalDeps = ['css-selector-parser'];

export default defineConfig({
	build: {
		lib: {
			entry: 'src/index.mjs',
			formats: ['es']
		},
		outDir: 'dist',
		emptyOutDir: false,
		minify: false,
		rolldownOptions: {
			external: externalDeps,
			output: {
				entryFileNames: 'arijs-stream-xml-parser.esm.js'
			}
		}
	},
	environments: {
		minified: {
			consumer: 'client',
			build: {
				// minify: 'oxc', // 67kb
				minify: 'terser', // 52kb
				rolldownOptions: {
					output: {
						entryFileNames: 'arijs-stream-xml-parser.esm.min.js'
					}
				}
			}
		}
	}
});
