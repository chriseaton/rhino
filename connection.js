const crypto = require('crypto');
const { EventEmitter } = require('events');
const tedious = require('tedious');
const EventTracker = require('./event-tracker.js');
const Log = require('./log.js');

/**
 * @enum {Number}
 * @readonly
 */
const CONNECTION_STATE = {
    IDLE: 0x01,
    CONNECTING: 0x02,
    DISCONNECTING: 0x04,
    TRANSACTING: 0x08,
    EXECUTING: 0x10
};

class Connection extends EventEmitter {
    constructor(tdsConfig, log) {
        super();

        /**
         * @type {TediousConfiguration}
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
     * Returns the processing state of the connection as flags.   
     * 0x01 = IDLE   
     * 0x02 = CONNECTING   
     * 0x04 = DISCONNECTING   
     * 0x08 = TRANSACTING   
     * 0x10 = EXECUTING
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

    _transitionTo(newState, err) {
        let oldState = this._state;
        if (newState !== oldState) {
            this._state = newState;
            this.emit('state', newState, oldState, err);
        }
    }

    /**
     * Resets a tedious connection.
     * @param {tedious.Connection} conn - The connection to reset.
     */
    _resetConnection(conn) {
    }

    /**
     * Creates and establishes a new tds connection.
     * @param {tedious.Connection} conn - The connection instance to establish
     */
    async _establishConnection(conn) {
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
            et.register('connect', connectHandler);
            conn.once('connect', connectHandler);
            et.register('error', errorHandler);
            conn.once('error', errorHandler);
        });
    }

    /**
     * Connects to the database.
     * @emits connected
     * @emits reset
     * @param {Boolean} [reset=false] - If truthy, any existing connection will be reset, and a new connection
     * will be established. Any other value will connect only if not already in a connected state.
     * @returns {Promise.<Connection>}
     */
    async connect(reset) {
        let self = this;
        if (this.connected && !reset) {
            this.log.debug(`[${this.id}] Already connected to server "${this.config.server}".`);
            return this;
        } else if (this._state === CONNECTION_STATE.CONNECTING) {
            //we are already attempting to connect in a different call.
            //wait for the connection to connect.
            await new Promise((resolve, reject) => {
                self.once('state', (newState, oldState, err) => {
                    if (err) reject();
                    else resolve();
                });
            });
            return this;
        } else if (this._state !== CONNECTION_STATE.IDLE) {
            throw new Error(`Connection [${this.id}] can not connect when the state is anything other than idle or connecting. This can occur if you are not waiting for your connection or query operations to complete.`);
        }
        //let's attempt connection!
        let conn = null;
        this._transitionTo(CONNECTION_STATE.CONNECTING);
        if (this.connected) {
            //perform a connection reset, rather than creating a new connection instance.
            conn = this._tdsConnection;
            await new Promise((resolve, reject) => {
                conn.once('connect', (err) => {
                    console.log('connectreset');
                });
                conn.on('debug', this._handleDebug.bind(this));
                conn.on('infoMessage', this._handleInfo.bind(this));
                conn.on('errorMessage', this._handleInfo.bind(this));
                conn.reset((err) => {
                    if (err) {
                        self._transitionTo(CONNECTION_STATE.IDLE);
                        console.log('reseterr', err);
                        reject(err);
                    } else resolve();
                    console.log('resetttt');
                });
            });
            this.emit('reset', this);
            this.log.debug(`[${this.id}] Reset connection to server "${this.config.server}".`);
        } else {
            //attempt connection
            let retry = (this.config.options ? this.config.options.connectionRetries : 0) || 0;
            while (retry >= 0) {
                //create and set a new connection
                conn = this._tdsConnection = new tedious.Connection(this.config);
                //establish common listeners
                conn.on('debug', this._handleDebug.bind(this));
                conn.on('infoMessage', this._handleInfo.bind(this));
                conn.on('errorMessage', this._handleInfo.bind(this));
                try {
                    await new Promise((resolve, reject) => {
                        conn.once('connect', (err) => {
                            if (err) {
                                self._transitionTo(CONNECTION_STATE.IDLE);
                                conn.removeAllListeners('debug');
                                conn.removeAllListeners('infoMessage');
                                conn.removeAllListeners('errorMessage');
                                reject(err);
                            } else {
                                resolve(conn);
                            }
                        });
                        conn.once('error', (err) => {
                            self._transitionTo(CONNECTION_STATE.IDLE);
                            conn.removeAllListeners('debug');
                            conn.removeAllListeners('infoMessage');
                            conn.removeAllListeners('errorMessage');
                            reject(err);
                        });
                    });
                    break;
                } catch (err) {
                    if (err.code === 'ESOCKET' && retry > 0) {
                        retry--;
                    } else {
                        throw err;
                    }
                }
            }
            this.log.debug(`[${this.id}] Connected to server "${this.config.server}".`);
        }
        //if we're here, the connection is likely good
        this._transitionTo(CONNECTION_STATE.IDLE);
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
            this.log.debug(`[${this.id}] Already disconnected from server "${this.config.server}".`);
            return this;
        } else if (this._state === CONNECTION_STATE.DISCONNECTING) {
            //we are already attempting to disconnect in a different call.
            //wait for the connection to disconnect.
            let self = this;
            await new Promise((resolve, reject) => {
                self.once('state', (newState, oldState, err) => {
                    if (err) reject();
                    else resolve();
                });
            });
            return this;
        } else if (this._state !== CONNECTION_STATE.IDLE) {
            throw new Error(`Connection [${this.id}] can not disconnect when the state is anything other than idle or disconnecting. This can occur if you are not waiting for your connection or query operations to complete.`);
        }
        this._transitionTo(CONNECTION_STATE.DISCONNECTING);
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
            conn.removeAllListeners('debug');
            conn.removeAllListeners('infoMessage');
            conn.removeAllListeners('errorMessage');
        }
        //set flags and log
        this._transitionTo(CONNECTION_STATE.IDLE);
        this.log.debug(`[${this.id}] Disconnected from server "${this.config.server}".`);
        this.emit('disconnected', this);
        return this;
    }

}

module.exports = Connection;