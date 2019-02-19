const Connection = require('./connection.js');
const rhino = require('./rhino');
require('jest');

describe('#connect', () => {
    test('Connects to the database and sets expected state.', async () => {
        let c = new Connection(rhino.defaultConfig());
        expect.assertions(2);
        try {
            await c.connect();
            expect(c.connected).toBe(true);
            expect(c.executing).toBe(false);
        } catch (err) {
            throw err;
        } finally {
            await c.disconnect();
        }
    });
    test('Connects to the database once and skips reconnecting on subsequent calls.', async () => {
        let c = new Connection(rhino.defaultConfig());
        expect.assertions(7);
        try {
            let resetCounter = 0;
            c.on('reset', () => resetCounter++);
            for (let x = 0; x < 3; x++) {
                await c.connect();
                expect(c.connected).toBe(true);
                expect(c.executing).toBe(false);
            }
            expect(resetCounter).toBe(0);
        } catch (err) {
            throw err;
        } finally {
            await c.disconnect();
        }
    });
    test('Reconnects to the database when using the @force = true argument.', async () => {
        let c = new Connection(rhino.defaultConfig());
        expect.assertions(7);
        try {
            let resetCounter = 0;
            c.on('reset', () => resetCounter++);
            for (var x = 0; x < 3; x++) {
                await c.connect(true);
                expect(c.connected).toBe(true);
                expect(c.executing).toBe(false);
            }
            expect(resetCounter).toBe(x - 1);
        } catch (err) {
            throw err;
        } finally {
            await c.disconnect();
        }
    });
});

describe('#disconect', () => {
    test('Multiple calls do not cause an error.', () => {
        let c = new Connection(rhino.defaultConfig());
        expect(() => {
            for (let x = 0; x < 5; x++)
                c.disconnect();
        }).not.toThrow();
    });
    test('Sets the #connected flag.', () => {
        let c = new Connection(rhino.defaultConfig());
        c._connected = true;
        c.disconnect();
        expect(c.connected).toBe(false);
    });
    test('Disconnects from the database.', async () => {
        let c = new Connection(rhino.defaultConfig());
        await c.connect();
        expect(c.connected).toBe(true);
        await c.disconnect();
        expect(c.connected).toBe(false);
    });
});