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
        db = rhino.create();
    });
    afterAll(() => {
        db.destroy();
    });
    test.only('runs a simple select query.', async () => {
        let r = await db.query('SELECT 1;');
        console.log(r);
        expect(r).toBeTruthy();
    });
});