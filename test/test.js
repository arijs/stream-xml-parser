import runner from './runner.js';

if (import.meta.url === `file://${process.argv[1]}`) {
	var test = process.argv[2];
	test = test && runner[test];
	test instanceof Function && test();
}
