const ConnectedQuery = require('./connected-query.js');
const Query = require('./query.js');
const Connection = require('./connection.js');
const EventTracker = require('./event-tracker.js');
const Result = require('./result.js');
const tedious = require('tedious');
const { Request: TDS_Request } = require('tedious');

/**
 * @typedef {Object} Transaction.SavePoint
 * @property {Boolean} savepoint=true
 * @property {String} name
 */

/**
 * The `Transaction` class provides the ability to queue multiple queries for execution under a SQL transaction, 
 * optionally including save-points. It exposes methods to commit and rollback the entire set of queries or to
 * a particular save-point.
 */
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
         * @type {Array.<Query|Transaction.SavePoint>}
         */
        this.queries = [];

        /**
         * The active TDS connection with an active transaction.
         * @private
         */
        this._conn = null;
    }

    /**
     * Runs a SQL statement on the database and returns the results.
     * @param {String} sql - The SQL statement to execute.
     * @param {Map.<String,*>|Object} [params] - Optional parameters `Object` or `Map` that will be added to the
     * "in" parameters of the query. Keys and property names are used as the parameter name, and the value as the 
     * parameter values.
     * @returns {Query}
     */
    query(sql, params) {
        if (!this.queries) {
            this.queries = [];
        }
        let q = new Query().sql(sql, params);
        this.queries.push(q);
        return q;
    }

    /**
     * Add a save-point to the transaction. This will follow the previously added query.
     * @throws Error if no queries are present. A save-point should follow at least one query.
     * @param {String} [name] - The name of the transaction savepoint. If no name is specified, one is automatically
     * generated. You can use this name with the rollback command.
     * @returns {String} Returns the name of the save-point.
     */
    savePoint(name) {
        let nameType = typeof name;
        if (nameType !== 'string' && nameType !== 'undefined') {
            throw new Error('The parameter "name" argument must be a string if specified.');
        } else if (!this.queries || !this.queries.length) {
            throw new Error('Failed to add transaction save-point. A save-point should follow at least one query.');
        } else if (this.queries.length > 0 && this.queries[this.queries.length - 1].savepoint) {
            throw new Error('Failed to add transaction save-point. A save-point can not follow another save-point.');
        }
        if (!name) {
            name = `rhino_tx_sp_${this.queries.length}${Date.now()}${Math.floor(Math.random() * 1000)}`;
        }
        this.queries.push({ savepoint: true, name: name });
        return name;
    }

    /**
     * Remove all queued queries from the transaction.
     */
    clear() {
        this.queries.length = 0;
    }

    /**
     * Commits all queries in the transaction queue.
     * @throws Error if the `pool` property is falsey.
     * @throws Error when a `txName` argument is not present and an `isolation` argument is specified.
     * @throws Error if there is an active connection already processing a transaction.
     * @param {String} [txName] = A name associated with the transaction - this is required when specifying an 
     * `isolation` argument value.
     * @param {tedious.ISOLATION_LEVEL|Number|String} [isolation] - The isolation level of the transaction. Values
     * can be numbers or strings corresponding to the `Transaction.ISOLATION_LEVEL` enum. For example:  
     * - READ_UNCOMMITTED
     * - READ_COMMITTED
     * - REPEATABLE_READ
     * - SERIALIZABLE
     * - SNAPSHOT
     * 
     * Defaults to the connection's isolation level, which is *usually* "READ_COMMITED".
     * 
     * @see {@link https://docs.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql|Microsoft documentation on transaction isolation levels.}
     * @see `Connection.TediousConfiguration.options.isolationLevel`
     * @see `Connection.TediousConfiguration.options.connectionIsolationLevel`
     * 
     * @returns {Promise.<Result|Array.<Result>>}
     */
    async commit(txName, isolation) {
        if (!this.pool) {
            throw new Error('The "pool" property is required.');
        } else if (!txName && isolation) {
            throw new Error('The parameter "txName" argument is required when a "isolation" argument value is provided.');
        } else if (this._conn && this._conn._tdsConnection.inTransaction) {
            throw new Error('Failed to commit transaction. There is an active connection, and it is already processing a transaction.');
        }
        if (this.queries && this.queries.length) {
            this._conn = await this.pool.acquire().promise;
            let self = this;
            //begin the transaction
            await new Promise((resolve, reject) => {
                let cb = (err) => {
                    if (err) {
                        reject(err);
                    }
                    resolve();
                };
                if (txName || isolation) {
                    self._conn._tdsConnection.beginTransaction(cb, txName, isolation);
                } else {
                    self._conn._tdsConnection.beginTransaction(cb);
                }
            });
            //add queries
            let queryResults = [];
            for (let q of this.queries) {
                if (q.savepoint === true) {
                    //add a save-point to the transaction.
                    await new Promise((resolve, reject) => {
                        self._conn._tdsConnection.saveTransaction((err) => {
                            if (err) {
                                reject(err);
                            }
                            resolve();
                        }, q.name);
                    });
                } else {
                    queryResults.push(await ConnectedQuery._executeRequest(q, this._conn));
                }
            }
            //commit the transaction
            await new Promise((resolve, reject) => {
                self._conn._tdsConnection.commitTransaction((err) => {
                    if (err) {
                        reject(err);
                    }
                    resolve();
                });
            });
            //done, release connection
            this._releaseConnection();
            //return results
            return Result.flatten(...queryResults);
        }
    }

    /**
     * Rolls back the active transaction.
     * @throws Error if the `pool` property is falsey.
     * @throws Error if there is no active transaction connection.
     * @throws Error if the active connection does not have an active transaction.
     * @param {String} [name] - The name of a savepoint to rollback to. If not specified, the entire transaction will
     * be rolled back.
     */
    async rollback(name) {
        if (!this.pool) {
            throw new Error('The "pool" property is required.');
        } else if (!this._conn) {
            //no connection was ever established, so just return
            return;
        } else if (!this._conn._tdsConnection.inTransaction) {
            throw new Error('Failed to rollback transaction. There is no active transaction on the connection.');
        }
        let self = this;
        //rollback the transaction
        await new Promise((resolve, reject) => {
            self._conn._tdsConnection.rollbackTransaction((err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            }, name);
        });
        //done, release connection
        this._releaseConnection();
    }

    /**
     * Releases the connection if it is attached. The connection is released back to the rhino pool.
     */
    _releaseConnection() {
        if (this._conn && this.pool) {
            this.pool.release(this._conn);
        }
        this._conn = null;
    }

}

/**
 * @enum {Number}
 * @readonly
 * @private
 */
Transaction.ISOLATION_LEVEL = tedious.ISOLATION_LEVEL;

module.exports = Transaction;