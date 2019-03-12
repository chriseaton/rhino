const crypto = require('crypto');
const { EventEmitter } = require('events');
const tedious = require('tedious');
const EventTracker = require('./event-tracker.js');
const Log = require('./log.js');

/**
 * The tedious configuration options are all fully supported. Some options support default values from environmental
 * variables, all of which use the `RHINO_MSSQL_` prefix.
 * 
 * For more details, please refer to: {@link http://tediousjs.github.io/tedious/api-connection.html#function_newConnection|Tedious on GitHub}
 * @typedef Connection.TediousConfiguration
 * @property {String} [server="localhost"] - A default value is checked for under the `RHINO_MSSQL_HOST` then `RHINO_MSSQL_SERVER` environmental variables.
 * @property {Object} [authentication]
 * @property {String} [authentication.type="default"] - A default value is checked for under the `RHINO_MSSQL_AUTH_TYPE` environmental variable.
 * @property {Object} [authentication.options]
 * @property {String} [authentication.options.userName] - A default value is checked for under the `RHINO_MSSQL_USER` then `RHINO_MSSQL_AUTH_USER` environmental variables.
 * @property {String} [authentication.options.password] - A default value is checked for under the `RHINO_MSSQL_PASSWORD` then `RHINO_MSSQL_AUTH_PASSWORD` environmental variables.
 * @property {String} [authentication.options.domain] - A default value is checked for under the `RHINO_MSSQL_DOMAIN` then `RHINO_MSSQL_AUTH_DOMAIN` environmental variables.
 * @property {Object} [options]
 * @property {Number} [options.port=1433] - A default value is checked for under the `RHINO_MSSQL_PORT` environmental variable.
 * @property {String} [options.instanceName=null] - A default value is checked for under the `RHINO_MSSQL_INSTANCE` then `RHINO_MSSQL_INSTANCE_NAME` environmental variables.
 * @property {String} [options.database="master"] - A default value is checked for under the `RHINO_MSSQL_DATABASE` environmental variable.
 * @property {String} [options.appName=""] - A default value is checked for under the `RHINO_MSSQL_APP_NAME` environmental variable.
 * @property {Number} [options.connectTimeout=15000]
 * @property {Number} [options.requestTimeout=15000]
 * @property {Number} [options.cancelTimeout=5000]
 * @property {Number} [options.connectionRetryInterval=500]
 * @property {Boolean} [options.encrypt=false] - A default value is checked for under the `RHINO_MSSQL_ENCRYPT` environmental variable.
 * @property {String} [options.tdsVersion="7_4"]
 * @property {String} [options.dateFormat="mdy"]
 * @property {Boolean} [options.fallbackToDefaultDb=false]
 * @property {Boolean} [options.enableAnsiNull=true]
 * @property {Boolean} [options.enableAnsiNullDefault=true]
 * @property {Boolean} [options.enableAnsiPadding=true]
 * @property {Boolean} [options.enableAnsiWarnings=true]
 * @property {Boolean} [options.enableConcatNullYieldsNull=true]
 * @property {Boolean} [options.enableCursorCloseOnCommit=false]
 * @property {Boolean} [options.enableImplicitTransactions=false]
 * @property {Boolean} [options.enableNumericRoundabort=false]
 * @property {Boolean} [options.enableQuotedIdentifier=true]
 * @property {Boolean} [options.rowCollectionOnDone=false]
 * @property {Boolean} [options.rowCollectionOnRequestCompletion=false]
 * @property {Number} [options.packetSize=4096]
 * @property {Boolean} [options.useUTC=true]
 * @property {Boolean} [options.abortTransactionOnError=null]
 * @property {String} [options.localAddress=null]
 * @property {Boolean} [options.useColumnNames=false]
 * @property {Boolean} [options.camelCaseColumns=false]
 * @property {Boolean} [options.columnNameReplacer=null]
 * @property {String} [options.isolationLevel="READ_COMMITED"]
 * @property {String} [options.connectionIsolationLevel="READ_COMMITED"]
 * @property {Boolean} [options.readOnlyIntent=false]
 * @property {Object} [options.cryptoCredentialsDetails]
 * @property {Object} [options.debug]
 * @property {Boolean} [options.debug.packet=false]
 * @property {Boolean} [options.debug.data=false]
 * @property {Boolean} [options.debug.payload=false]
 * @property {Boolean} [options.debug.token=false]
 */

/**
 * @enum {Number}
 * @readonly
 * @private
 */
const CONNECTION_STATE = {
    IDLE: 0,
    CONNECTING: 1,
    DISCONNECTING: 2,
    TRANSACTING: 3,
    EXECUTING: 4
};

/**
 * @type {Array.<String>}
 * @readonly
 * @private
 */
const CONNECTION_STATE_KEYS = Object.keys(CONNECTION_STATE);

/**
 * Provides access to the database through a TDS connection.
 */
class Connection extends EventEmitter {
    /**
     * Creates a new `Connection` instance.
     * @param {Connection.TediousConfiguration} tdsConfig - The configuration for the connection.
     * @param {Log} log - A loging instance. if not provided, one is created using the given configuration.
     */
    constructor(tdsConfig, log) {
        super();

        /**
         * @type {Connection.TediousConfiguration}
         */
        this.config = tdsConfig;
        
        /**
         * @type {Log}
         */
        this.log = log || new Log(tdsConfig.logging);

        /**
         * @type {String}
         * @private
         */
        this._id = crypto.randomBytes(16).toString('hex');

        /**
         * @type {Number}
         * @private
         */
        this._state = CONNECTION_STATE.IDLE;

        /**
         * @type {EventTracker}
         * @private
         */
        this._eventTracker = new EventTracker();

        /**
         * The working tedious connection.
         * @type {tedious.Connection}
         * @private
         */
        this._tdsConnection = null;
    }

    /**
     * Boolean flag indicating whether the connection is valid and alive.
     * @type {Boolean}
     */
    get connected() {
        if (this._tdsConnection) {
            return (this._tdsConnection.closed === false && this._tdsConnection.loggedIn);
        }
        return false;
    }

    /**
     * Returns the processing state of the connection.
     * 
     * Accessible through the `Connection.CONNECTION_STATES` object.
     * 
     * @type {Number}
     */
    get state() {
        return this._state;
    }

    /**
     * Randomly generated connection identifier. Output in debugging messages.
     * @type {String}
     */
    get id() {
        return this._id;
    }

    /**
     * Transition event fired when the connection state is changed.
     *
     * @event Connection#transition
     * @type {object}
     * @property {Number} newState
     * @property {Number} oldState
     * @property {*} meta
     */

    /**
     * Transitions the connection state to a new state if that state differs from the current state. The `state` event
     * is emitted when the state changes.
     * @emits Connection#transition
     * @param {Number} state - The state to transition to.
     * @param {*} [meta] - Attach metadata to the transition event.
     * @returns {Boolean} Returns `true` when a state change occurred. If the state did not change, `false` is
     * returned.
     * @private
     */
    _transitionTo(state, meta) {
        if (!CONNECTION_STATE_KEYS[state]) {
            throw new Error(`The value of the "newState" parameter argument is invalid. "${state}" is not a valid connection state key.`);
        }
        let oldState = this._state;
        if (state !== oldState) {
            this._state = state;
            this.emit('state', state, oldState, meta);
            return true;
        }
        return false;
    }

    /**
     * Awaits the next transition from the current connection state to another.
     * @returns {*}
     * @private
     */
    async _nextTransition() {
        let self = this;
        let transition = {
            newState: null,
            oldState: null,
            meta: null
        };
        await new Promise((resolve, reject) => {
            self.once('state', (newState, oldState, meta) => {
                transition.newState = newState;
                transition.oldState = oldState;
                transition.meta = meta;
                if (meta && (meta instanceof Error || meta.constructor === Error)) {
                    reject(meta);
                } else if (meta && meta.error) {
                    reject(meta.error);
                } else {
                    resolve();
                }
            });
        });
        return transition;
    }

    /**
     * Creates and establishes a new tds connection.
     * @throws Error when the "conn" parameter argument is not provided.
     * @throws Error when the connection fails for any reason.
     * @param {tedious.Connection} conn - The required TDS connection instance to use to test for connection.
     * @private
     */
    async _establishConnection(conn) {
        if (!conn) {
            throw new Error('The parameter "conn" argument is required and was not provided.');
        }
        //check if connection already established.
        if (conn.closed === false && conn.loggedIn) {
            return;
        }
        //no connection, wait for even resolution.
        await new Promise((resolve, reject) => {
            let et = new EventTracker();
            let connectHandler = (err) => {
                et.removeFrom(conn);
                if (err) {
                    reject(err);
                } else {
                    resolve(conn);
                }
            };
            let errorHandler = (err) => {
                if (err) {
                    et.removeFrom(conn);
                    reject(err);
                }
            };
            et.registerOn(conn, 'connect', connectHandler);
            et.registerOn(conn, 'error', errorHandler);
        });
        
    }

    /**
     * Ensures the connection to the database has been established.
     * 
     * If the connection is already `connected` then no action occurs and this function returns normally and only
     * emits the `connected` event.
     * 
     * If the connection is already attempting to connect, this call will (a)wait for it to complete and emit a
     * `connected` event if successful. 
     * 
     * If the connection is not established, it will be attempted and the `connecting` and `connected` events will be
     * emitted.
     * @emits connecting
     * @emits connected
     * @returns {Promise.<Connection>}
     */
    async connect() {
        if (this.connected) {
            if (this.config.logging && this.config.logging.connections) {
                this.log.debug(`[${this.id}] Already connected to server "${this.config.server}".`);
            }
            this.emit('connected', this);
            return this;
        } else if (this._state === CONNECTION_STATE.CONNECTING) {
            //we are already attempting to connect in a different call.
            //wait for the connection to connect or fail and do the same.
            await this._nextTransition();
            this.emit('connected', this);
            return this;
        } else if (this._state !== CONNECTION_STATE.IDLE) {
            //not already connecting, connected, or idle, so throw
            throw new Error(`Connection [${this.id}] can not be established when the state is ${CONNECTION_STATE_KEYS[this._state]}. This can occur if you are not waiting for your connection or query operations to complete.`);
        }
        //ensure the old connection is cleared out
        if (this._tdsConnection) {
            this._tdsConnection.cleanupConnection(0);
            this._eventTracker.removeFrom(this._tdsConnection);
            this._eventTracker.unregister();
        }
        //establish the connection... or fail
        this._transitionTo(CONNECTION_STATE.CONNECTING);
        this.emit('connecting', this);
        try {
            this._tdsConnection = new tedious.Connection(this.config);
            await this._establishConnection(this._tdsConnection);
            //add event listeners
            if (this.config.logging && this.config.logging.tds) {
                //enable debugging listeners.
                let debugListener = this._handleDebug.bind(this);
                let infoListener = this._handleInfo.bind(this);
                this._eventTracker.register('debug', debugListener);
                this._eventTracker.register('infoMessage', infoListener);
                this._tdsConnection.on('debug', debugListener);
                this._tdsConnection.on('infoMessage', infoListener);
            }
            let errorListener = this._handleInfo.bind(this);
            this._eventTracker.register('errorMessage', errorListener);
            this._tdsConnection.on('errorMessage', errorListener);
            this._transitionTo(CONNECTION_STATE.IDLE);
        } catch (err) {
            this._transitionTo(CONNECTION_STATE.IDLE, err);
            throw err;
        }
        //if we're here, the connection is likely good
        if (this.config.logging && this.config.logging.connections) {
            this.log.debug(`[${this.id}] Connected to server "${this.config.server}".`);
        }
        this.emit('connected', this);
        return this;
    }

    /**
     * Handles a TDS connection debug output.
     * @listens tedious.Connection#debug
     * @param {String} message - The debugging message. 
     * @private
     */
    _handleDebug(message) {
        this.log.debug(`[${this.id}][SQL Debug] ${message}`);
    }

    /**
     * Handles a TDS connection info output.
     * @listens tedious.Connection#info
     * @param {Object} info - The debugging information object. 
     * @private
     */
    _handleInfo(info) {
        this.log.debug(`[${this.id}][SQL Debug Info]`, info);
    }

    /**
     * Disconnects from the database.
     * @emits disconnected
     * @returns {Promise.<Connection>}
     */
    async disconnect() {
        if (this.connected === false) {
            if (this.config.logging && this.config.logging.connections) {
                this.log.debug(`[${this.id}] Already disconnected from server "${this.config.server}".`);
            }
            this.emit('disconnected', this);
            return this;
        } else if (this._state === CONNECTION_STATE.DISCONNECTING) {
            //we are already attempting to disconnect in a different call.
            //wait for the connection to disconnect.
            await this._nextTransition();
            this.emit('disconnected', this);
            return this;
        } else if (this._state !== CONNECTION_STATE.IDLE) {
            throw new Error(`Connection [${this.id}] can not be disconnected when the state is ${CONNECTION_STATE_KEYS[this._state]}. This can occur if you are not waiting for your connection or query operations to complete.`);
        }
        this._transitionTo(CONNECTION_STATE.DISCONNECTING);
        this.emit('disconnecting', this);
        if (this._tdsConnection) {
            let conn = this._tdsConnection;
            await new Promise((resolve, reject) => {
                conn.once('end', (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(conn);
                    }
                });
                conn.close();
            });
            //unregister event handlers
            this._eventTracker.removeFrom(conn);
            this._eventTracker.unregister();
        }
        //things have disconnected
        this._transitionTo(CONNECTION_STATE.IDLE);
        if (this.config.logging && this.config.logging.connections) {
            this.log.debug(`[${this.id}] Disconnected from server "${this.config.server}".`);
        }
        this.emit('disconnected', this);
        return this;
    }

}

/**
 * Enumeration of connection states that a connection can be in.
 * 
 * 1 = IDLE   
 * 2 = CONNECTING   
 * 3 = DISCONNECTING   
 * 4 = TRANSACTING   
 * 5 = EXECUTING
 * @enum {Number}
 * @readonly
 */
Connection.CONNECTION_STATE = CONNECTION_STATE;

module.exports = Connection;