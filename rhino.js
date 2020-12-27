const tarn = require('tarn');
const Log = require('./log.js');
const Connection = require('./connection.js');
const ConnectedQuery = require('./connected-query.js');
const BulkQuery = require('./bulk-query.js');
const Transaction = require('./transaction.js');
const Result = require('./result.js');
const Query = require('./query.js');

/**
 * Please refer to:  {@link https://github.com/Vincit/tarn.js|Tarn on GitHub}
 * @typedef Rhino.PoolConfiguration
 * @property {Number} [max=1]
 * @property {Number} [min=0]
 * @property {Number} [acquireTimeoutMillis=30000]
 * @property {Number} [createTimeoutMillis=30000]
 * @property {Number} [idleTimeoutMillis=30000]
 * @property {Number} [reapIntervalMillis=1000]
 * @property {Number} [createRetryIntervalMillis=200]
 */

/**
 * 
 * @typedef Rhino.RhinoBaseConfiguration
 * @property {Rhino.PoolConfiguration} [pool]
 * @property {Log.LogConfiguration} [logging]
 */

/**
 * Rhino's configuration fully implements all configuration properties from `tedious`.
 * @see {@link http://tediousjs.github.io/tedious/api-connection.html#function_newConnection|Tedious}
 * @see {@link https://github.com/Vincit/tarn.js|Tarn}
 * @typedef {Connection.TediousConfiguration | Rhino.RhinoBaseConfiguration} Rhino.RhinoConfiguration
 */

/**
 * Rhino is a managed Microsoft SQL Server driver powered by tedious and node-pool. This class defines functionality
 * to execute queries and utlize transactions. Under the hood it handles all connection pooling, including opening
 * and closing of connections to the database. 
 * 
 * You can use multiple instances of the Rhino class in your application - each one can utilize a different 
 * configuration.
 */
class Rhino {
    /**
     * Constructs a `Rhino` instance using the specified `config` values.
     * @param {Rhino.RhinoConfiguration} [config] - Configuration values to use in this `Rhino` instance. Any properties not
     * explicitly specified will use the default values.
     */
    constructor(config) {

        /**
         * @type {Rhino.RhinoConfiguration}
         */
        this.config = Rhino.defaultConfig(config);

        /**
         * @type {Log}
         */
        this.log = new Log(this.config.logging);

        /**
         * @type {tarn.Pool}
         * @private
         */
        this._pool = this._createPool(this.config.pool);

        //start listening for process hangups
        this._handleProcessTermination();
    }

    /**
     * Listens to process termination events so the rhino instance can cleanup resources.
     * @see {@link Rhino+destroy}
     * @private
     */
    _handleProcessTermination() {
        let self = this;
        process.on('exit', () => {
            self.destroy();
        });
    }

    /**
     * Destroys internal pooled resources in this instance. This is called automatically when the process exits.
     * @param {Function} [done] - Callback function when the destruction is complete.
     */
    destroy(done) {
        if (this._pool) {
            let self = this;
            this._pool.destroy().then(() => {
                let m = self;
                if (done) {
                    done();
                }
            });
        } else if (done) {
            done();
        }
    }

    /**
     * Creates a pool instance meant for internal use by the active `Rhino` instance. 
     * @param {genericPool.Options} config - The pool configuration options.
     * @returns {genericPool.Pool} 
     * @private
     */
    _createPool(config) {
        config = Object.assign(
            {
                min: 0,
                max: 10
            },
            config,
            {
                propagateCreateError: true,
                create: this._createResource.bind(this),
                destroy: this._destroyResource.bind(this),
                validate: this._validateResource.bind(this)
            });
        return new tarn.Pool(config);
    }

    /**
     * Pool factory function to return a connection resource.
     * @returns {Connection}
     * @private
     */
    _createResource() {
        this.log.debug('Pool creating resource...');
        let r = new Connection(this.config, this.log);
        return r.connect();
    }

    /**
     * Pool factory function destroy a resource.
     * @param {Connection} resource - The resource to be destroyed.
     * @private
     */
    async _destroyResource(resource) {
        this.log.debug('Pool destroying resource...');
        if (resource) {
            resource.disconnect();
        }
    }

    /**
     * Pool factory function to validate a resource.
     * @param {Connection} resource - The resource to be validated.
     * @private
     */
    async _validateResource(resource) {

    }

    /**
     * Attempts to connect to the database. This method utilizes the internal connection pool, and will return `true`
     * if a connection is already opened and active. If the connection cannot be established for any reason, including
     * an error, a `false` is returned.
     * 
     * Note that if an error occurs in this function call, it is *not* thrown, but it will be logged normally.
     * 
     * @returns {Boolean} Returns `true` when a connection was successfully aquired. A `false` value is returned if the
     * connection cannot be aquired for any reason.
     */
    async ping() {
        try {
            let res = await this._pool.acquire().promise;
            await this._pool.release(res);
            return true;
        } catch (err) {
            this.log.error(err);
        }
        return false;
    }

    transaction() {
        return new Transaction(this._pool);
    }

    /**
     * Runs a SQL statement on the database and returns the results.
     * @param {String} sql - The SQL statement to execute.
     * @param {Map.<String,*>|Object} [params] - Optional parameters `Object` or `Map` that will be added to the
     * "in" parameters of the query. Keys and property names are used as the parameter name, and the value as the 
     * parameter values.
     * @returns {ConnectedQuery|Promise.<Result>}
     */
    query(sql, params) {
        return new ConnectedQuery(this._pool).sql(sql, params);
    }

    /**
     * Creates a new bulk-loading query that can be used to rapidly insert large amounts of data.
     * @param {String} tableName - The name of the table to perform the bulk insert.
     * @param {BulkQuery.Options} options - Options to pass to the bulk query.
     * @returns {BulkQuery}
     */
    bulk(tableName, options) {
        return new BulkQuery(tableName, options, this._pool);
    }

    /**
     * This function creates a new `Rhino` instance to act as a pool for executing database queries. You can create
     * multiple `Rhino` instances to manage multiple pools of connections or for different databases.
     * 
     * @example
     * const rhino = require('rhino');
     *
     * let pool1 = rhino.create({
     *         server: 'server-001',
     *         database: 'databaseA' 
     *         ... 
     *     });
     * let pool2 = rhino.create({
     *         server: 'server-002',
     *         database: 'databaseB' 
     *         ... 
     *     });
     * @param {RhinoConfiguration} [config] - Configuration values to use in this `Rhino` instance. Any properties not
     * explicitly specified will use the default values.
     * @returns {Rhino}
     */
    static create(config) {
        return new Rhino(config);
    }

    /**
     * Returns a default `RhinoConfiguration` object. Default values are first searched for in environmental variables
     * then, if not found, with hard-coded default values.
     * @param {RhinoConfiguration} [config] - Optional configuration value overrides.
     * @returns {RhinoConfiguration}
     */
    static defaultConfig(config) {
        let dc = {
            server: process.env.RHINO_MSSQL_HOST || process.env.RHINO_MSSQL_SERVER || 'localhost',
        };
        if (config) {
            dc = Object.assign(dc, config);
        }
        //build options
        dc.options = {
            encrypt: process.env.RHINO_MSSQL_ENCRYPT || false,
            connectionRetries: 3,
            trustServerCertificate: process.env.RHINO_MSSQL_TRUST_CERT || false,
            validateBulkLoadParameters: true
        };
        if (process.env.RHINO_MSSQL_INSTANCE || process.env.RHINO_MSSQL_INSTANCE_NAME) {
            dc.options.instanceName = process.env.RHINO_MSSQL_INSTANCE || process.env.RHINO_MSSQL_INSTANCE_NAME;
        }
        //only use a port when the instance name is not present or explicity defined.
        if (!dc.options.instanceName || process.env.RHINO_MSSQL_PORT) { 
            dc.options.port = process.env.RHINO_MSSQL_PORT || 1433;
        } 
        if (process.env.RHINO_MSSQL_DATABASE) {
            dc.options.database = process.env.RHINO_MSSQL_DATABASE;
        }
        if (process.env.RHINO_MSSQL_APP_NAME) {
            dc.options.appName = process.env.RHINO_MSSQL_APP_NAME;
        }
        if (config && config.options) {
            dc.options = Object.assign(dc.options, config.options);
        }
        //build authentication
        dc.authentication = {
            type: process.env.RHINO_MSSQL_AUTH_TYPE || 'default',
            options: {
                userName: process.env.RHINO_MSSQL_USER || process.env.RHINO_MSSQL_AUTH_USER || null,
                password: process.env.RHINO_MSSQL_PASSWORD || process.env.RHINO_MSSQL_AUTH_PASSWORD || null,
                domain: process.env.RHINO_MSSQL_DOMAIN || process.env.RHINO_MSSQL_AUTH_DOMAIN || null
            }
        };
        if (config && config.authentication) {
            dc.authentication = Object.assign(dc.authentication, config.authentication);
        }
        //build logging
        dc.logging = {
            mode: (typeof process.env.RHINO_LOGGING !== 'undefined' ? process.env.RHINO_LOGGING : false)
        };
        if (config && config.logging) {
            dc.logging = Object.assign(dc.logging, config.logging);
        }
        //done
        return dc;
    }

}

Rhino.Types = Query.TYPE;

module.exports = Rhino;