const Connection = require('./connection.js');
const rhino = require('./rhino');
require('jest');

describe('Multiple Connection instances.', () => {
    test('Can connect and disconnect multiple connections at once (100).', async () => {
        let connections = [];
        let promises = [];
        for (let x = 0; x < 1000; x++) {
            connections.push(new Connection(rhino.defaultConfig()));
            promises.push(connections[x].connect());
        }
        try {
            await Promise.all(promises);
            for (let c of connections) {
                expect(c.connected).toBe(true);
            }
            promises.length = 0;
        } catch (err) {
            throw err;
        }
        for (let c of connections) {
            promises.push(c.disconnect());
        }
        try {
            await Promise.all(promises);
            for (let c of connections) {
                expect(c.connected).toBe(false);
            }
        } catch (err) {
            throw err;
        }
    }, 5 * 60 * 1000);
    test('Handles connection storm of randomized connects/disconnects (100 instances, 100 iterations).', async () => {
        let connections = [];
        let storm = [];
        for (let x = 0; x < 100; x++) {
            connections.push(new Connection(rhino.defaultConfig()));
            connections[x].config.logging.mode = false; //disable logging for this test... it's a doozy.
        }
        for (let r = 0; r < 100; r++) {
            let startIndex = Math.floor(Math.random() * (connections.length - 1));
            let endIndex = startIndex + Math.floor(Math.random() * (connections.length - startIndex));
            let promises = [];
            for (let i = startIndex; i < endIndex; i++) {
                if (Math.random() < 0.6) { //tend to opt for connection attempts
                    promises.push(connections[i].connect());
                } else {
                    promises.push(connections[i].disconnect());
                }
            }
            await Promise.all(promises);
        }
        //disconnect everything
        let promises = [];
        for (let c of connections) {
            promises.push(c.disconnect());
        }
        try {
            await Promise.all(promises);
            for (let c of connections) {
                expect(c.connected).toBe(false);
            }
        } catch (err) {
            throw err;
        }
    });
});

describe('#connect', () => {
    test('Connects to the database and sets expected state.', async () => {
        let c = new Connection(rhino.defaultConfig());
        expect.assertions(1);
        try {
            await c.connect();
            expect(c.connected).toBe(true);
        } catch (err) {
            throw err;
        } finally {
            await c.disconnect();
        }
    });
    test('Connects to the database once and skips reconnecting on subsequent calls.', async () => {
        let c = new Connection(rhino.defaultConfig());
        expect.assertions(4);
        try {
            let resetCounter = 0;
            c.on('reset', () => resetCounter++);
            for (let x = 0; x < 3; x++) {
                await c.connect();
                expect(c.connected).toBe(true);
            }
            expect(resetCounter).toBe(0);
        } catch (err) {
            throw err;
        } finally {
            await c.disconnect();
        }
    });
    test('Reconnects to the database when using the @reset = true argument.', async () => {
        let c = new Connection(rhino.defaultConfig());
        expect.assertions(4);
        try {
            let resetCounter = 0;
            c.on('reset', () => resetCounter++);
            for (var x = 0; x < 3; x++) {
                await c.connect(true);
                expect(c.connected).toBe(true);
            }
            expect(resetCounter).toBe(x - 1);
        } catch (err) {
            throw err;
        } finally {
            await c.disconnect();
        }
    });
    // test.only('blah.', async () => {
    //     let tedious = require('tedious');
    //     let c = new Connection(rhino.defaultConfig());
    //     await c.connect(true);
    //     expect(c.connected).toBe(true);
    //     await c.disconnect();
    //     let conn = c._tdsConnection;
    //     conn.connect();
    //     console.log(conn)
    //     // await new Promise((resolve, reject) => {
    //     //     let request = new tedious.Request("select 42, 'hello world'", function (err, rowCount) {
    //     //         if (err) {
    //     //             console.log(err);
    //     //             reject(err);
    //     //         } else {
    //     //             console.log(rowCount + ' rows');
    //     //             resolve();
    //     //         }
    //     //     });
    //     //     conn.execSql(request);
    //     // });
    // });
});

describe('#disconect', () => {
    test('Sets the #connected flag to false.', () => {
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