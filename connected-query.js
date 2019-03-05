const { Request: TDS_Request } = require('tedious');
const EventTracker = require('./event-tracker.js');
const Query = require('./query.js');
const tarn = require('tarn');

/**
 * Provides promise extensions to a `Query` object and allows it to be executed on an aquired connection.
 * @private
 */
class ConnectedQuery extends Query {
    /**
     * Creates a new instance of a `ConnectedQuery`. 
     * @param {tarn.Pool} pool - The connection pool to utilize for aquiring the connection.
     */
    constructor(pool) {
        super();
        //validate
        if (!pool) {
            throw new Error('The parameter "pool" argument is required.');
        }

        /**
         * The `tarn.Pool` instance linked to this query.
         * @type {tarn.Pool}
         */
        this.pool = pool;
    }

    /**
     * Thenable executor of this query using the linked connection or transaction.
     * @throw Error if the `pool` property is falsey.
     * @param {Function} [resolve] - Promise callback called when the work completes successfully.
     * @param {Function} [reject] - Promise callback called when the work fails.
     */
    async then(resolve, reject) {
        if (!this.pool) {
            if (reject) {
                reject(new Error('The "pool" property is required.'));
            }
            return;
        }
        //execute the query directly on TDS connection.
        try {
            let res = await this.pool.acquire().promise;
            let r = this._toRequest();
            resolve('ok');
            this.pool.release(res);
        } catch (err) {
            reject(err);
        }
    }

    /**
     * Converts the query to a TDS Request object for use with a TDS connection.
     * @returns {TDS_Request}
     * @private
     */
    _toRequest() {
        let tracker = new EventTracker();
        let r = new TDS_Request(this.statement, (err, rowCount, rows) => {

        });
        for (let { key, value } of this.params) {

        }
        return r;
    }

}

module.exports = ConnectedQuery;