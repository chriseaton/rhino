const ConnectedQuery = require('./connected-query.js');

require('jest');

describe('#then', () => {
    test('returns a Promise that rejects on a missing pool property.', async () => {
        let cq = new ConnectedQuery({});
        cq.pool = null;
        expect.assertions(1);
        try {
            await cq;
        } catch(err) {
            expect(err.message).toContain('pool');
        }
    });
});