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
    then(resolve, reject) {
        let p = this.pool;
        if (!p) {
            if (reject) {
                reject(new Error('The "pool" property is required.'));
            }
            return;
        }
        //execute the query directly on TDS connection.
        p.acquire().promise
            .then((res) => {
                console.log(res);
                resolve('ok');
                p.release(res);
            })
            .catch((err) => {
                if (reject) {
                    reject(err);
                }
            });
    }

}

module.exports = ConnectedQuery;