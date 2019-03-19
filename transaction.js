const ConnectedQuery = require('./connected-query.js');
const Query = require('./query.js');

class Transaction {
    /**
     * Creates a new instance of a `Transaction`. 
     * @param {tarn.Pool} pool - The connection pool to utilize for aquiring the connection.
     */
    constructor(pool) {
        //validate
        if (!pool) {
            throw new Error('The parameter "pool" argument is required.');
        }

        /**
         * The `tarn.Pool` instance linked to this query.
         * @type {tarn.Pool}
         */
        this.pool = pool;

        /**
         * @type {Array.<Query>}
         */
        this.queries = [];
    }

    
}

module.exports = Transaction;