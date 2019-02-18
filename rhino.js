const tarn = require('tarn');
const Log = require('./log.js');
const Connection = require('./connection.js');
const Transaction = require('./transaction.js');

require('dotenv').load();

/**
 * The tedious configuration options are all fully supported. Some options support default values from environmental
 * variables, all of which use the `RHINO_MSSQL_` prefix.
 * For more details, please refer to: {@link http://tediousjs.github.io/tedious/api-connection.html#function_newConnection|Tedious on GitHub}
 * @typedef TediousConfiguration
 * @property {String} [server="localhost"] - A default value is checked for under the `RHINO_MSSQL_HOST` then `RHINO_MSSQL_SERVER` environmental variables.
 * @property {Number} [port=1433] - A default value is checked for under the `RHINO_MSSQL_PORT` environmental variable.
 * @property {String} [instanceName=null] - A default value is checked for under the `RHINO_MSSQL_INSTANCE` then `RHINO_MSSQL_INSTANCE_NAME` environmental variables.
 * @property {String} [database="master"] - A default value is checked for under the `RHINO_MSSQL_DATABASE` environmental variable.
 * @property {String} [appName="Tedious"] - A default value is checked for under the `RHINO_MSSQL_APP_NAME` environmental variable.
 * @property {Number} [connectTimeout=15000]
 * @property {Number} [requestTimeout=15000]
 * @property {Number} [cancelTimeout=5000]
 * @property {Number} [connectionRetryInterval=500]
 * @property {Boolean} [encrypt=false] - A default value is checked for under the `RHINO_MSSQL_ENCRYPT` environmental variable.
 * @property {Object} [authentication]
 * @property {String} [authentication.type="default"] - A default value is checked for under the `RHINO_MSSQL_AUTH_TYPE` environmental variable.
 * @property {Object} [authentication.options]
 * @property {String} [authentication.options.userName] - A default value is checked for under the `RHINO_MSSQL_USER` then `RHINO_MSSQL_AUTH_USER` environmental variables.
 * @property {String} [authentication.options.password] - A default value is checked for under the `RHINO_MSSQL_PASSWORD` then `RHINO_MSSQL_AUTH_PASSWORD` environmental variables.
 * @property {String} [authentication.options.domain] - A default value is checked for under the `RHINO_MSSQL_DOMAIN` then `RHINO_MSSQL_AUTH_DOMAIN` environmental variables.
 * @property {String} [tdsVersion="7_4"]
 * @property {String} [dateFormat="mdy"]
 * @property {Boolean} [fallbackToDefaultDb=false]
 * @property {Boolean} [enableAnsiNull=true]
 * @property {Boolean} [enableAnsiNullDefault=true]
 * @property {Boolean} [enableAnsiPadding=true]
 * @property {Boolean} [enableAnsiWarnings=true]
 * @property {Boolean} [enableConcatNullYieldsNull=true]
 * @property {Boolean} [enableCursorCloseOnCommit=false]
 * @property {Boolean} [enableImplicitTransactions=false]
 * @property {Boolean} [enableNumericRoundabort=false]
 * @property {Boolean} [enableQuotedIdentifier=true]
 * @property {Boolean} [rowCollectionOnDone=false]
 * @property {Boolean} [rowCollectionOnRequestCompletion=false]
 * @property {Number} [packetSize=4096]
 * @property {Boolean} [useUTC=true]
 * @property {Boolean} [abortTransactionOnError=null]
 * @property {String} [localAddress=null]
 * @property {Boolean} [useColumnNames=false]
 * @property {Boolean} [camelCaseColumns=false]
 * @property {Boolean} [columnNameReplacer=null]
 * @property {String} [isolationLevel="READ_COMMITED"]
 * @property {String} [connectionIsolationLevel="READ_COMMITED"]
 * @property {Boolean} [readOnlyIntent=false]
 * @property {Object} [cryptoCredentialsDetails]
 */

/**
 * Please refer to:  {@link https://github.com/Vincit/tarn.js|Tarn on GitHub}
 * @typedef PoolConfiguration
 * @property {Number} [max=1]
 * @property {Number} [min=0]
 * @property {Number} [acquireTimeoutMillis=30000]
 * @property {Number} [createTimeoutMillis=30000]
 * @property {Number} [idleTimeoutMillis=30000]
 * @property {Number} [reapIntervalMillis=1000]
 * @property {Number} [createRetryIntervalMillis=200]
 */

/**
 * @typedef LogConfiguration
 * @property {Boolean|String} mode - Can be 'error', 'warn', or 'debug for enabled logging levels. A falsey value will
 * disable logging. A truthy value that is not a string will assume 'warn' mode.
 */

/**
 * 
 * @typedef RhinoBaseConfiguration
 * @property {PoolConfiguration} [pool]
 * @property {LogConfiguration} [logging]
 */

/**
 * Rhino's configuration fully implements all configuration properties from `tedious`.
 * @see {@link http://tediousjs.github.io/tedious/api-connection.html#function_newConnection|Tedious}
 * @see {@link https://github.com/Vincit/tarn.js|Tarn}
 * @typedef {TediousConfiguration | RhinoBaseConfiguration} RhinoConfiguration
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
     * @param {RhinoConfiguration} [config] - Configuration values to use in this `Rhino` instance. Any properties not
     * explicitly specified will use the default values.
     */
    constructor(config) {

        /**
         * @type {RhinoConfiguration}
         */
        this.config = Object.assign({
            server: process.env.RHINO_MSSQL_HOST || process.env.RHINO_MSSQL_SERVER || 'localhost',
            port: process.env.RHINO_MSSQL_PORT || 1433,
            instanceName: process.env.RHINO_MSSQL_INSTANCE || process.env.RHINO_MSSQL_INSTANCE_NAME || null,
            database: process.env.RHINO_MSSQL_DATABASE || null,
            appName: process.env.RHINO_MSSQL_APP_NAME || null,
            encrypt: process.env.RHINO_MSSQL_ENCRYPT || false,
            authentication: {
                type: process.env.RHINO_MSSQL_AUTH_TYPE || 'default',
                options: {
                    userName: process.env.RHINO_MSSQL_USER || process.env.RHINO_MSSQL_AUTH_USER || null,
                    password: process.env.RHINO_MSSQL_PASSWORD || process.env.RHINO_MSSQL_AUTH_PASSWORD || null,
                    domain: process.env.RHINO_MSSQL_DOMAIN || process.env.RHINO_MSSQL_AUTH_DOMAIN || null
                }
            }
        }, config);

        /**
         * @type {Log}
         */
        this.log = new Log(this.config.logging);

        /**
         * @type {tarn.Pool}
         * @private
         */
        this._pool = this._createPool(this.config.pool);

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
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGBUS', 'SIGFPE', 'SIGSEGV', 'SIGTERM'].forEach(function (sig) {
            process.on(sig, (signal, number) => {
                self.destroy();
            });
        });
    }

    /**
     * Destroys internal pooled resources in this instance. This is called automatically when the process exits.
     * @param {Function} [done] - Callback function when the destruction is complete.
     */
    destroy(done) {
        if (this._pool) {
            this._pool.destroy().then(() => {
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

    async transaction() {
        let res = await this._pool.acquire();
        return new Transaction(res);
    }

    async query(sql, ...parameters) {
        let res = await this._pool.acquire();
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

}

module.exports = Rhino;