const { Request: TDS_Request, BulkLoad: TDS_BulkLoad } = require('tedious');
const EventTracker = require('./event-tracker.js');
const Connection = require('./connection.js');
const Query = require('./query.js');
const Result = require('./result.js');
const tarn = require('tarn');

/**
 * @typedef {BulkQuery | Promise.<Result>} PromiseBulkQuery
 */

/**
 * @typedef BulkQuery.Options
 * @property {Boolean} checkConstraints - Honors constraints during bulk load, using T-SQL CHECK_CONSTRAINTS.
 * @property {Boolean} fireTriggers - Honors insert triggers during bulk load, using the T-SQL FIRE_TRIGGERS. 
 * @property {Boolean} keepNulls - Honors null value passed, ignores the default values set on table, using T-SQL KEEP_NULLS.
 * @property {Boolean} tableLock - Places a bulk update(BU) lock on table while performing bulk load, using T-SQL TABLOCK.
 * @property {Number} timeout - The number of milliseconds before the bulk load is considered failed, or 0 for no timeout.
 */

/**
 * Provides promise extensions to a `BulkQuery` object and allows it to be executed on an aquired connection.
 */
class BulkQuery {
    /**
     * Creates a new instance of a `BulkQuery`. 
     * @param {String} tableName - The name of the table to perform the bulk insert.
     * @param {BulkQuery.Options} options - Options to pass to the bulk query.
     * @param {tarn.Pool} pool - The connection pool to utilize for aquiring the connection.
     */
    constructor(tableName, options, pool) {
        //validate
        if (!pool) {
            throw new Error('The parameter "pool" argument is required.');
        }

        /**
         * @type {String}
         */
        this.tableName = tableName || null;

        /**
         * @type {BulkQuery.Options}
         */
        this.options = options || {};

        /**
         * The `tarn.Pool` instance linked to this query.
         * @type {tarn.Pool}
         */
        this.pool = pool;

        /**
         * Tracks the state of the bulk-query & connection objects and promises.
         * @private
         */
        this.state = {
            /** @param {TDS_BulkLoad} */
            bulk: null,
            /** @type {Promise.<Number>} */
            done: null,
            /** @type {Connection} */
            connection: null
        }
    }

    /**
     * Establishes a connection to begin a bulk-load operation.    
     * This is called automatically upon `column` or `row`, so you generally *do not* need to call it explicitly.
     * @returns {BulkQuery}
     */
    async aquire() {
        if (!this.pool) {
            throw new Error('The "pool" property is required.');
        }
        if (!this.state.bulk) {
            //execute the query directly on TDS connection.
            //note to self: avoid using async on thennables... it creates... oddities.
            this.state.connection = await this.pool.acquire().promise;
            this.state.bulk = this.state.connection._tdsConnection.newBulkLoad(this.tableName, this.options);
            if (typeof this.options.timeout === 'number') {
                this.state.bulk.setTimeout(this.options.timeout);
            }
            //create the bulk callback wrapped in a promise
            let me = this;
            this.state.done = new Promise((res, rej) => {
                me.state.bulk.callback = (err, rowCount) => {
                    if (err) {
                        rej(err);
                    } else {
                        res(rowCount);
                    }
                };
            }).finally(() => {
                if (me.state.connection) {
                    me.pool.release(me.state.connection);
                }
            });
        }
        return this;
    }

    /**
     * Fire and complete the bulk-load.
     */
    async execute() {
        this.state.connection._tdsConnection.execBulkLoad(this.state.bulk);
        return await this.state.done;
    }

    /**
     * Adds a column to the bulk query.
     * @param {String} name - The column name.
     * @param {QueryTypes} type - The TDS type of the column.
     * @param {*} options - column options.
     * @returns {BulkQuery}
     */
    async column(name, type, options) {
        await this.aquire();
        this.state.bulk.addColumn(name, type, options);
        return this;
    }

    /**
     * Adds a row to the bulk query.
     * @param {Array|Object} row - The row object or array. If an object it should have key/value pairs representing 
     * column name and value. If an array then it should represent the values of each column in the same order which 
     * they were added to the `BulkQuery` object.
     * @returns {BulkQuery}
     */
    async add(row) {
        await this.aquire();
        this.state.bulk.addRow(row);
        return this;
    }

}

module.exports = BulkQuery;