const rhino = require('./rhino.js');
const Query = require('./query.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
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
    describe('non-data selects', () => {
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
        test('throws properly on connection is lost or resets (unstable connection).', async () => {
            let db = rhino.create();
            expect.assertions(2);
            try {
                await db.ping();
                let conn = db._pool.free[0].resource;
                let p = db.query('WAITFOR DELAY \'00:00:05\';');
                //simulate a unexpected termination of the connection.
                await new Promise((r) => setTimeout(r, 1000));
                conn._tdsConnection.socket.end(); 
                await p;
            } catch (err) {
                expect(err).toBeTruthy();
                expect(err.code).toBe('ESOCKET');
            } finally {
                db.destroy();
            }
        }, 10000);
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
            //test param object approach
            r = await db
                .query('SELECT @a AS A, @b AS B, @c AS C;', {
                    a: 1, b: 'hello', c: 'world'
                });
            expect(r).toBeTruthy();
            expect(r.columns.length).toBe(3);
            expect(r.rows.length).toBe(1);
            expect(r.rows[0][0]).toBe(1);
            expect(r.rows[0][1]).toBe('hello');
            expect(r.rows[0][2]).toBe('world');
            //test param map approach
            let m = new Map();
            m.set('a', 1);
            m.set('b', 'hello');
            m.set('c', 'world');
            r = await db.query('SELECT @a AS A, @b AS B, @c AS C;', m);
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
        test('runs multiple non-data queries where some may fail, but will not affect others.', async () => {
            let db = rhino.create({
                options: {
                    useColumnNames: false
                }
            });
            expect.assertions(4);
            await db.query('SELECT 1 AS A, \'hello\' AS B, \'world\' AS C;');
            try {
                await db.query('SELECTINVALID X*$)323');
            } catch (err) {
                expect(err).toBeTruthy();
            }
            let r = await db.query('SELECT 1');
            expect(r).toBeTruthy();
            expect(r.rows.length).toBe(1);
            expect(r.rows[0][0]).toBe(1);
            db.destroy();
        });
        test('runs a stored procedure that uses out parameters.', async () => {
            let db = rhino.create({
                options: {
                    useColumnNames: false
                }
            });
            let r = await db
                .query('EXEC dbo.uspLogError')
                .out('ErrorLogID', null, 'INT');
            expect(r).toBeTruthy();
            expect(r.rows.length).toBe(1);
            expect(r.columns.length).toBe(1);
            expect(r.columns[0].name).toBe('ErrorLogID');
            expect(r.columns[0].parameter).toBe(true);
            expect(r.rows[0][0]).not.toBeNull();
            db.destroy();
        });
        test('pool releases resources that are unused.', async () => {
            let db = rhino.create({
                options: {
                    useColumnNames: false
                }
            });
            await db.query('SELECT 1 AS A, \'hello\' AS B, \'world\' AS C;');
            try {
                await db.query('SELECTINVALID X*$)323');
            } catch (err) {
                expect(err).toBeTruthy();
            }
            for (let x = 0; x < 50; x++) {
                await Promise.all([
                    db.query('SELECT 1'),
                    db.query('SELECT 2'),
                    db.query('SELECT 3'),
                    db.query('SELECT 4')
                ]);
                await db.query('SELECT 123');
            }
            expect(db._pool.free.length).toBeLessThanOrEqual(4);
            db.destroy();
        });
    });
    describe('batch', () => {
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
        test('batches a large script from memory.', async () => {
            let data = fs.readFileSync(path.resolve(__dirname, 'test/batch-load.sql'));
            let q = db.query(data.toString('utf8'));
            expect(q.mode).toBe(Query.MODE.BATCH);
            let r = await q;
            expect(r).toBeTruthy();
            r = await db.query('SELECT COUNT(*) FROM Theme;');
            expect(r.rows.length).toBe(1);
            expect(r.rows[0][0]).toBe(100);
        });
    });
});

describe('#bulk', () => {
    /** @type {rhino} */
    let db = null;
    beforeAll(() => {
        db = rhino.create({
            options: {
                useColumnNames: false
            }
        });
    });
    afterAll(async () => {
        await db.destroy();
    });
    test('performs a bulk load of rows into a table.', async () => {
        let bk = db.bulk('Theme', { timeout: 5000 });
        await bk.column('Name', Query.TYPE.VarChar, { nullable: false, length: 512 });
        await bk.column('HexCode', Query.TYPE.VarChar, { nullable: false, length: 512 });
        for (let x = 0; x < 1000; x++) {
            bk.add({ Name: `name${x}`, HexCode: `#000${x}${x}${x}` });
        }
        //add null and undefined rows (should be skipped).
        bk.add(null);
        bk.add(undefined);
        let result = await bk.execute();
        expect(result).toBe(1000);
    }, 5000);
    test('ensures that rows are objects.', async () => {
        let bk = db.bulk('Theme');
        await expect(bk.add(123)).rejects.toThrow();
        await expect(bk.add(true)).rejects.toThrow();
        await expect(bk.add('hello')).rejects.toThrow();
    });
});

describe('#transaction', () => {
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
    test('runs a simple non-data multi-statement select queries.', async () => {
        let tx = db.transaction();
        tx.query('SELECT 1 AS A, \'hello\' AS B, \'world\' AS C; SELECT 123; SELECT \'ABC\';');
        tx.query('SELECT TOP 1 * FROM Production.Culture WHERE CultureID = \'en\';');
        let r = await tx.commit();
        expect(r.length).toBe(4);
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
        expect(r[3].rows.length).toBe(1);
        expect(r[3].rows[0][0]).toBe('en    ');
        expect(r[3].rows[0][1]).toBe('English');
        expect(r[3].rows[0][2]).toBeInstanceOf(Date);
    });
    test('rollback completes when no commit occurred.', async () => {
        let tx = db.transaction();
        tx.query('INSERT INTO Production.Culture (CultureID, Name) VALUES (\'zz\', @name);', { name: 'TXTEST' });
        await tx.rollback();
        let r = await db.query('SELECT * FROM Production.Culture WHERE Name = @name', { name: 'TXTEST' });
        expect(r.rows.length).toBe(0);
    });
    test('rollback completes after a commit fails.', async () => {
        let tx = db.transaction();
        try {
            tx.query('INSERT INTO Production.Culture (CultureID, Name) VALUES (\'ca\', @name);', { name: 'TXTEST' });
            tx.query('THISWILLFAIL;');
            await tx.commit();
        } catch (err) {
            await tx.rollback();
        }
        let r = await db.query('SELECT * FROM Production.Culture WHERE CultureID = @culture', { culture: 'ca' });
        expect(r.rows.length).toBe(0);
    });
    test('rollback works up to the last savepoint.', async () => {
        await db.query('DELETE FROM Production.Culture WHERE Name = @name', { name: 'SPTEST' });
        let tx = db.transaction();
        try {
            tx.query('INSERT INTO Production.Culture (CultureID, Name) VALUES (\'spt\', @name);', { name: 'SPTEST' });
            tx.savePoint('insertsptest');
            //insert a duplicate record after the savepoint (would create 2 results with the name if it was committed).
            tx.query('INSERT INTO Production.Culture (CultureID, Name) VALUES (\'spt2\', @name);', { name: 'SPTEST' });
            //fail (identity insert conflict)
            tx.query('INSERT INTO Production.Culture (CultureID, Name) VALUES (\'spt\', \'Shouldnt exist.\');');
            await tx.commit();
        } catch (err) {
            await tx.rollback('insertsptest');
        }
        let r = await db.query('SELECT * FROM Production.Culture WHERE Name = @name', { name: 'SPTEST' });
        expect(r.rows.length).toBe(1);
        await db.query('DELETE FROM Production.Culture WHERE Name = @name', { name: 'SPTEST' });
    });
});