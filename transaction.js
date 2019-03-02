const Connection = require('./connection.js');

class Transaction {
    /**
     * 
     * @param {Connection} conn - The connection used by the transaction.
     */
    constructor(conn) {
        //validate
        if (!conn) {
            throw new Error('The parameter "conn" argument is required.');
        }

        /**
         * The rhino instance linked to this query.
         * @type {Rhino}
         */
        this.rhino = null;

    }
}

module.exports = Transaction;