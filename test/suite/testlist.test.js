import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { testList } from '../../src/index.mjs';

function makeTest(testFn, min, max, greedy) {
	return { test: testFn, min, max, greedy };
}

const isEven = makeTest(x => x % 2 === 0, 1, Infinity, true);
const isOdd = makeTest(x => x % 2 !== 0, 1, Infinity, true);
const is10Multiple = makeTest(x => x % 10 === 0, 1, 1, false);
const isExact5 = makeTest(x => x === 5, 1, 1, false);
const isEvenNot10 = makeTest(x => x !== 10 && x % 2 === 0, 1, Infinity, true);
const anyOne = makeTest(() => true, 1, 1, false);
const anyZeroOrMore = makeTest(() => true, 0, Infinity, true);

describe('testList', () => {
	describe('single test', () => {
		it('succeeds when all items pass single greedy test', () => {
			const result = testList([isEven], [2, 4, 6, 8]);
			assert.equal(result.success, true);
		});

		it('fails when any item fails single greedy test', () => {
			const result = testList([isEven], [2, 4, 5, 8]);
			assert.equal(result.success, false);
		});

		it('fails when all items fail single greedy test', () => {
			const result = testList([isEven], [1, 3, 5, 7]);
			assert.equal(result.success, false);
		});

		it('succeeds with empty list and min=0', () => {
			const zeroOrMore = makeTest(() => true, 0, Infinity, true);
			const result = testList([zeroOrMore], []);
			assert.equal(result.success, true);
		});

		it('fails with empty list and min=1', () => {
			const result = testList([isEven], []);
			assert.equal(result.success, false);
		});
	});

	describe('multiple tests', () => {
		it('succeeds with even+, 10-multiple, even+', () => {
			const result = testList([isEven, is10Multiple, isEven], [2, 4, 10, 6, 8]);
			assert.equal(result.success, true);
		});

		it('fails when 10-multiple is absent', () => {
			const result = testList([isEven, is10Multiple, isEven], [2, 4, 6, 8]);
			assert.equal(result.success, false);
		});

		it('fails when 10-multiple is at beginning', () => {
			const result = testList([isEven, is10Multiple, isEven], [10, 2, 4, 6, 8]);
			assert.equal(result.success, false);
		});

		it('fails when 10-multiple is at end', () => {
			const result = testList([isEven, is10Multiple, isEven], [2, 4, 6, 8, 10]);
			assert.equal(result.success, false);
		});
	});

	describe('exact match', () => {
		it('matches exactly one specific value', () => {
			const result = testList([isExact5], [5]);
			assert.equal(result.success, true);
		});

		it('fails for different value', () => {
			const result = testList([isExact5], [6]);
			assert.equal(result.success, false);
		});

		it('fails for multiple items when max=1', () => {
			const result = testList([isExact5], [5, 5]);
			assert.equal(result.success, false);
		});
	});

	describe('complex sequences', () => {
		it('evenNot10+, 10mul, 10mul, even+ succeeds correctly', () => {
			const result = testList(
				[isEvenNot10, is10Multiple, is10Multiple, isEven],
				[2, 4, 10, 100, 6, 8]
			);
			assert.equal(result.success, true);
		});

		it('evenNot10+, 10mul, 10mul, even+ fails when 10 at start', () => {
			const result = testList(
				[isEvenNot10, is10Multiple, is10Multiple, isEven],
				[10, 2, 4, 10, 100, 6, 8]
			);
			assert.equal(result.success, false);
		});

		it('handles leading odd numbers with odd+, exact5, even+', () => {
			const result = testList(
				[isOdd, isExact5, isEven],
				[1, 3, 5, 6, 8]
			);
			assert.equal(result.success, true);
		});
	});

	describe('greedy vs non-greedy', () => {
		it('greedy test consumes as many items as possible', () => {
			const result = testList([isEven, isExact5], [2, 4, 5]);
			assert.equal(result.success, true);
		});

		it('non-greedy test matches minimal items', () => {
			// anyOne matches exactly one, anyZeroOrMore matches the rest
			const result = testList([anyOne, anyZeroOrMore], [1, 2, 3]);
			assert.equal(result.success, true);
		});
	});

	describe('empty inputs', () => {
		it('succeeds when both test list and item list are empty', () => {
			const result = testList([], []);
			assert.equal(result.success, true);
		});

		it('fails when test list is non-empty but items are empty (min > 0)', () => {
			const result = testList([isEven], []);
			assert.equal(result.success, false);
		});

		it('succeeds when test list has only zero-min tests and items are empty', () => {
			const optionalTest = makeTest(() => true, 0, Infinity, true);
			const result = testList([optionalTest], []);
			assert.equal(result.success, true);
		});
	});

	describe('result structure', () => {
		it('result contains active and attemptsList on success', () => {
			const result = testList([isEven], [2, 4]);
			assert.ok(result.active);
			assert.ok(Array.isArray(result.attemptsList));
		});

		it('result contains failed array', () => {
			const result = testList([isEven], [1, 2]);
			assert.ok(Array.isArray(result.failed));
		});
	});
});
