const rhino = require('./rhino.js');
require('jest');

describe('#ping', () => {
    test('returns true when connection is established.', async () => {
        let pool = rhino.create();
        let results = await pool.ping();
        pool.destroy();
        expect(results).toBe(true);
    });
    test('returns true when connection is already established.', async () => {
        let pool = rhino.create();
        await pool.ping();
        let results = await pool.ping();
        pool.destroy();
        expect(results).toBe(true);
    });
    test('returns false when a connection cannot be established.', async () => {
        let pool = rhino.create({
            server: 'idontexist_bad_server'
        });
        let results = await pool.ping();
        pool.destroy();
        expect(results).toBe(false);
    });
});

describe('#query', () => {
    let db = null;
    beforeAll(() => {
        db = rhino.create({
            options: {
                useColumnNames: false
            }
        });
    });
    afterAll(() => {
        db.destroy();
    });
    test('runs a simple non-data select query returning row objects.', async () => {
        let db = rhino.create({
            options: {
                useColumnNames: true
            }
        });
        try {
            let r = await db.query('SELECT 1 AS A, \'hello\' AS B, \'world\' AS C;');
            expect(r).toBeTruthy();
            expect(r.columns.length).toBe(3);
            expect(r.rows.length).toBe(1);
            expect(r.rows[0].A).toBe(1);
            expect(r.rows[0].B).toBe('hello');
            expect(r.rows[0].C).toBe('world');
        } catch (err) {
            throw err;
        } finally {
            db.destroy();
        }
    });
    test('runs a simple non-data select query returning row value arrays.', async () => {
        let r = await db.query('SELECT 1 AS A, \'hello\' AS B, \'world\' AS C;');
        expect(r).toBeTruthy();
        expect(r.columns.length).toBe(3);
        expect(r.rows.length).toBe(1);
        expect(r.rows[0][0]).toBe(1);
        expect(r.rows[0][1]).toBe('hello');
        expect(r.rows[0][2]).toBe('world');
    });
    test('runs a simple non-data select using parameters.', async () => {
        let r = await db
            .query('SELECT @a AS A, @b AS B, @c AS C;')
            .in('a', 1)
            .in('b', 'hello')
            .in('c', 'world');
        expect(r).toBeTruthy();
        expect(r.columns.length).toBe(3);
        expect(r.rows.length).toBe(1);
        expect(r.rows[0][0]).toBe(1);
        expect(r.rows[0][1]).toBe('hello');
        expect(r.rows[0][2]).toBe('world');
    });
    test('runs a simple non-data multi-statement select query.', async () => {
        let r = await db.query('SELECT 1 AS A, \'hello\' AS B, \'world\' AS C; SELECT 123; SELECT \'ABC\';');
        expect(Array.isArray(r)).toBeTruthy();
        expect(r.length).toBe(3);
        expect(r[0].columns.length).toBe(3);
        expect(r[0].rows.length).toBe(1);
        expect(r[0].rows[0][0]).toBe(1);
        expect(r[0].rows[0][1]).toBe('hello');
        expect(r[0].rows[0][2]).toBe('world');
        expect(r[1].columns.length).toBe(1);
        expect(r[1].rows.length).toBe(1);
        expect(r[1].rows[0][0]).toBe(123);
        expect(r[2].columns.length).toBe(1);
        expect(r[2].rows.length).toBe(1);
        expect(r[2].rows[0][0]).toBe('ABC');
    });
    test('runs a simple non-data multi-statement select query with parameters.', async () => {
        let r = await db
            .query('SELECT @a AS A, @b AS B, @c AS C; SELECT 123; SELECT @b + @c;')
            .in('a', 1)
            .in('b', 'hello')
            .in('c', 'world');
        expect(Array.isArray(r)).toBeTruthy();
        expect(r.length).toBe(3);
        expect(r[0].columns.length).toBe(3);
        expect(r[0].rows.length).toBe(1);
        expect(r[0].rows[0][0]).toBe(1);
        expect(r[0].rows[0][1]).toBe('hello');
        expect(r[0].rows[0][2]).toBe('world');
        expect(r[1].columns.length).toBe(1);
        expect(r[1].rows.length).toBe(1);
        expect(r[1].rows[0][0]).toBe(123);
        expect(r[2].columns.length).toBe(1);
        expect(r[2].rows.length).toBe(1);
        expect(r[2].rows[0][0]).toBe('helloworld');
    });
});