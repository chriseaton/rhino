const { Request: TDS_Request } = require('tedious');
const EventTracker = require('./event-tracker.js');
const Connection = require('./connection.js');
const Query = require('./query.js');
const Result = require('./result.js');
const tarn = require('tarn');

/**
 * @typedef {Query | Promise.<Result>} PromiseQuery
 */

/**
 * Provides promise extensions to a `Query` object and allows it to be executed on an aquired connection.
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
     * @returns {Promise.<Result>}
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
            let conn = await this.pool.acquire().promise;
            let r = await this._executeRequest(conn);
            resolve(r);
            this.pool.release(conn);
            return r;
        } catch (err) {
            reject(err);
            throw err;
        }
    }

    /**
     * Converts the query to a TDS Request object for use with a TDS connection.
     * @param {Connection} conn - The connection resource aquired from the pool.
     * @returns {Promise.<Result>}
     * @private
     */
    async _executeRequest(conn) {
        let self = this;
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
                    if (!self.exec && !res.columns.length && !res.rows.length) {
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
            if (self.exec && !self.batch) {
                //looks like a singular exec statement.
                conn._tdsConnection.callProcedure(context.req);
            } else if (self.batch && self.params.size === 0) {
                //batch query without params.
                conn._tdsConnection.execSqlBatch(context.req);
            } else {
                //everything else
                conn._tdsConnection.execSql(context.req);
            }
        });
    }

}

module.exports = ConnectedQuery;