const Transaction = require('./transaction.js');
require('jest');

describe('#constructor', () => {
    test('throws when a pool argument is not provided.', () => {
        expect(() => { new Transaction(); }).toThrow('pool');
    });
});

describe('#clear', () => {
    test('clears all active queries and savepoints.', () => {
        let t = new Transaction({});
        t.query('SELECT 1');
        t.savePoint();
        t.clear();
        expect(t.queries.length).toBe(0);
    });
});

describe('#savePoint', () => {
    test('adds a save-point to the query queue.', () => {
        let t = new Transaction({});
        t.query('SELECT 1');
        t.savePoint();
        expect(t.queries.length).toBe(2);
        expect(t.queries[1].savepoint).toBe(true);
    });
    test('throws if the save-point is requested before any queries are added.', () => {
        let t = new Transaction({});
        expect(() => t.savePoint()).toThrow(/follow.+query/i);
        expect(() => t.savePoint('abc')).toThrow(/follow.+query/i);
    });
    test('throws if the save-point is added right after another save-point', () => {
        let t = new Transaction({});
        t.query('SELECT 1');
        t.savePoint();
        expect(() => t.savePoint()).toThrow(/follow.+save/i);
        expect(() => t.savePoint('abc')).toThrow(/follow.+save/i);
    });
    test('throws on a non-string @name', () => {
        let t = new Transaction({});
        t.query('SELECT 1');
        expect(() => t.savePoint(true)).toThrow('name');
        expect(() => t.savePoint(false)).toThrow('name');
        expect(() => t.savePoint(new Date())).toThrow('name');
        expect(() => t.savePoint(0)).toThrow('name');
        expect(() => t.savePoint(1234)).toThrow('name');
        expect(() => t.savePoint('ok')).not.toThrowError();
    });
    test('returns the @name provided.', () => {
        let t = new Transaction({});
        t.query('SELECT 1');
        expect(t.savePoint('test')).toBe('test');
        t.query('SELECT 1');
        expect(t.savePoint('abc')).toBe('abc');
    });
    test('returns randomly generated save-point name.', () => {
        let t = new Transaction({});
        t.query('SELECT 1');
        expect(typeof t.savePoint()).toBe('string');
        t.query('SELECT 1');
        expect(t.savePoint().length).toBeGreaterThan(0);
        //make sure they are random
        let lastNames = [];
        for (let x = 0; x < 100; x++) {
            t.query('SELECT 1');
            let n = t.savePoint();
            expect(lastNames).not.toContain(n);
            lastNames.push(n);
        }
    });
});