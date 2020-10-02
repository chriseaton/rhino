const Connection = require('./connection.js');
const rhino = require('./rhino');
require('dotenv').config();
require('jest');

describe('Multiple Connection instances.', () => {
    test('Can connect and disconnect multiple connections at once (100).', async () => {
        let connections = [];
        let promises = [];
        for (let x = 0; x < 100; x++) {
            connections.push(new Connection(rhino.defaultConfig()));
            promises.push(connections[x].connect());
        }
        await Promise.all(promises);
        for (let c of connections) {
            expect(c.connected).toBe(true);
        }
        promises.length = 0;
        for (let c of connections) {
            promises.push(c.disconnect());
        }
        await Promise.all(promises);
        for (let c of connections) {
            expect(c.connected).toBe(false);
        }
    }, 1 * 60 * 1000);
    test('Handles connection storm of randomized connects/disconnects (100 instances, 200 iterations).', async () => {
        let connections = [];
        for (let x = 0; x < 100; x++) {
            connections.push(new Connection(rhino.defaultConfig()));
            connections[x].config.logging.mode = false; //disable logging for this test... it's a doozy.
        }
        for (let r = 0; r < 200; r++) {
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
    }, 1 * 60 * 1000);
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
        try {
            let connectingCount = 0;
            let connectedCount = 0;
            c.on('connecting', () => connectingCount++);
            c.on('connected', () => connectedCount++);
            for (let x = 0; x < 4; x++) {
                let r = await c.connect();
                expect(r).toBe(c);
                expect(c.connected).toBe(true);
            }
            expect(connectingCount).toBe(1);
            expect(connectedCount).toBe(4);
        } catch (err) {
            throw err;
        } finally {
            await c.disconnect();
        }
        expect.assertions(10);
    });
    test('Makes the connection attempt on the first async call, all others await the completion.', async () => {
        let c = new Connection(rhino.defaultConfig());
        try {
            let connectingCount = 0;
            let connectedCount = 0;
            c.on('connecting', () => connectingCount++);
            c.on('connected', () => connectedCount++);
            let attempts = [];
            for (let x = 0; x < 4; x++) {
                attempts.push(c.connect());
            }
            let results = await Promise.all(attempts);
            for (let r of results) {
                expect(r).toBe(c);
            }
            expect(connectingCount).toBe(1);
            expect(connectedCount).toBe(4);
        } catch (err) {
            throw err;
        } finally {
            await c.disconnect();
        }
        expect.assertions(6);
    });
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