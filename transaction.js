const ConnectedQuery = require('./connected-query.js');
const Query = require('./query.js');
const Connection = require('./connection.js');
const EventTracker = require('./event-tracker.js');
const Result = require('./result.js');
const tedious = require('tedious');
const { Request: TDS_Request } = require('tedious');

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

        /**
         * The active TDS connection with an active transaction.
         * @private
         */
        this._conn = null;
    }

    /**
     * Runs a SQL statement on the database and returns the results.
     * @param {String} sql - The SQL statement to execute.
     * @returns {ConnectedQuery|Promise.<Result>}
     */
    query(sql) {
        if (!this.queries) {
            this.queries = [];
        }
        let q = new Query().sql(sql);
        this.queries.push(q);
        return q;
    }

    /**
     * Add a save-point to the transaction. This will follow the previously added query.
     * @throws Error if no queries are present. A save-point should follow at least one query.
     */
    savePoint() {
        if (!this.queries || !this.queries.length) {
            throw new Error('Failed to add transaction save-point. A save-point should follow at least one query.');
        }
        this.queries.push(true);
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
     * @returns {Array.<Result>}
     */
    async commit(txName, isolation) {
        if (!this.pool) {
            throw new Error('The "pool" property is required.');
        } else if (!txName && isolation) {
            throw new Error('The parameter "txName" argument is required when a "isolation" argument value is provided.');
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
                if (txName && isolation) {
                    self._conn._tdsConnection.beginTransaction(cb, txName, isolation);
                } else {
                    self._conn._tdsConnection.beginTransaction(cb);
                }
            });
            //add queries
            let queryQueue = [];
            for (let q of this.queries) {
                if (q === true) {
                    //add a save-point to the transaction.
                    await new Promise((resolve, reject) => {
                        self._conn.saveTransaction((err) => {
                            if (err) {
                                reject(err);
                            }
                            resolve();
                        });
                    });
                } else {
                    queryQueue.push(this._executeRequest(q, this._conn));
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
            //gather results
            let results = await Promise.all(queryQueue);
            return results;
        }
    }

    /**
     * Rolls back the active transaction.
     * @throws Error if the `pool` property is falsey.
     * @throws Error if there is no active transaction connection.
     */
    async rollback() {
        if (!this.pool) {
            throw new Error('The "pool" property is required.');
        } else if (!this._conn) {
            throw new Error('Failed to rollback transaction. There is no active transaction connection.');
        }
        let self = this;
        //rollback the transaction
        await new Promise((resolve, reject) => {
            self._conn.rollbackTransaction((err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });
    }

    /**
     * Converts the query to a TDS Request object for use with a TDS connection.
     * @param {Query} q - The query to convert to a TDS request.
     * @param {Connection} conn - The connection resource aquired from the pool.
     * @returns {Promise.<Result>}
     * @private
     */
    async _executeRequest(q, conn) {
        let self = q;
        return new Promise((resolve, reject) => {
            let context = {
                useColumnNames: conn.config.options.useColumnNames,
                tracker: new EventTracker(),
                results: [new Result()],
                req: null
            };
            //build the request object with callback
            context.req = new TDS_Request(self.statement, (err) => {
                if (err) {
                    if (conn.log) {
                        conn.log.error(err);
                    }
                    context.tracker.removeFrom(context.req);
                    reject(err);
                }
            });
            //add timeout if specified
            if (self.requestTimeout >= 0) {
                context.req.setTimeout(self.requestTimeout);
            }
            //add parameters
            for (let [key, value] of self.params) {
                if (value.output) {
                    context.req.addOutputParameter(key, value.type, value.value, value.options);
                } else {
                    context.req.addParameter(key, value.type, value.value, value.options);
                }
            }
            //add event listeners
            let errorHandler = (err) => {
                if (err) {
                    if (conn.log) {
                        conn.log.error(err);
                    }
                    context.tracker.removeFrom(context.req);
                }
            };
            let colHandler = (columns) => {
                let res = context.results[context.results.length - 1];
                if (context.useColumnNames) {
                    for (let p in columns) {
                        res.columns.push(columns[p]);
                    }
                } else {
                    res.columns = columns;
                }
            };
            let rowHandler = (rowData) => {
                let res = context.results[context.results.length - 1];
                if (context.useColumnNames) {
                    let row = {};
                    for (let p in rowData) {
                        row[p] = rowData[p].value;
                    }
                    res.rows.push(row);
                } else {
                    res.rows.push(rowData.map(c => c.value));
                }
            };
            let statementDoneHandler = (rowCount, more) => {
                if (more) {
                    context.results.push(new Result());
                }
            };
            let inExecDoneHandler = (rowCount, more) => {
                let res = context.results[context.results.length - 1];
                //only move to a new result if the last result was used - ignore if it was just an empty token.
                if (res.returned !== null || res.columns.length || res.rows.length) {
                    context.results.push(new Result());
                }
            };
            let execDoneHandler = (rowCount, more, returnValue) => {
                let res = context.results[context.results.length - 1];
                res.returned = returnValue;
                if (more) {
                    context.results.push(new Result());
                } else {
                    //check if running non-exec query, and if so, discard the last empty result
                    if (self.mode !== Query.MODE.EXEC && !res.columns.length && !res.rows.length) {
                        context.results.splice(context.results.length - 1, 1);
                    }
                }
            };
            let completeHandler = () => {
                context.tracker.removeFrom(context.req);
                if (context.results.length === 1) {
                    resolve(context.results[0]);
                } else {
                    resolve(context.results);
                }
            };
            context.tracker.registerOn(context.req, 'error', errorHandler);
            context.tracker.registerOn(context.req, 'columnMetadata', colHandler);
            context.tracker.registerOn(context.req, 'row', rowHandler);
            context.tracker.registerOn(context.req, 'done', statementDoneHandler);
            context.tracker.registerOn(context.req, 'doneInProc', inExecDoneHandler);
            context.tracker.registerOn(context.req, 'doneProc', execDoneHandler);
            context.tracker.registerOn(context.req, 'requestCompleted', completeHandler);
            //make the call
            if (self.mode === Query.MODE.EXEC) {
                //looks like a singular exec statement.
                conn._tdsConnection.callProcedure(context.req);
            } else if (self.mode === Query.MODE.BATCH && self.params.size === 0) {
                //batch query without params.
                conn._tdsConnection.execSqlBatch(context.req);
            } else {
                //everything else
                conn._tdsConnection.execSql(context.req);
            }
        });
    }

}

/**
 * @enum {Number}
 * @readonly
 * @private
 */
Transaction.ISOLATION_LEVEL = tedious.ISOLATION_LEVEL;

module.exports = Transaction;