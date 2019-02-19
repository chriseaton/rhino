const crypto = require('crypto');
const { EventEmitter } = require('events');
const tedious = require('tedious');
const Log = require('./log.js');

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
         * @type {Boolean}
         * @private
         */
        this._connected = false;

        /**
         * @type {Boolean}
         * @private
         */
        this._executing = false;

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
        return this._connected;
    }

    /**
     * Boolean flag indicating whether the connection is currently executing a request.
     * @type {Boolean}
     */
    get executing() {
        return this._executing;
    }

    /**
     * Randomly generated connection identifier. Output in debugging messages.
     * @type {String}
     */
    get id() {
        return this._id;
    }

    /**
     * Connects to the database.
     * @emits connected
     * @emits reset
     * @param {Boolean} [reset=false] - If true, any existing connection will be reset, and a new connection
     * will be established. Any other value will connect only if not already in a connected state.
     * @returns {Promise.<Connection>}
     */
    async connect(reset) {
        if (this._connected === false
            || !this._tdsConnection
            || (this._tdsConnection && this._tdsConnection.closed === true)
            || reset === true) {
            let conn = null;
            if (this._tdsConnection) {
                conn = this._tdsConnection;
                await new Promise((resolve, reject) => {
                    conn.reset((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                this.emit('reset', this);
                this.log.debug(`[${this.id}] Reset connection to server "${this.config.server}".`);
            } else {
                //create and set a new connection
                conn = this._tdsConnection = new tedious.Connection(this.config);
                //establish common listeners
                if (this.config.debug) {
                    conn.on('debug', this._handleDebug.bind(this));
                    conn.on('infoMessage', this._handleInfo.bind(this));
                    conn.on('errorMessage', this._handleInfo.bind(this));
                }
                //attempt connection
                await new Promise((resolve, reject) => {
                    conn.once('connect', (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(conn);
                        }
                    });
                });
                this.log.debug(`[${this.id}] Connected to server "${this.config.server}".`);
            }
            //if we're here, the connection is good.
            this._connected = true;
            this._executing = false;
        } else {
            this.log.debug(`[${this.id}] Already connected to server "${this.config.server}".`);
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
        if (this.config.debug) {
            this.log.debug(`[${this.id}][SQL Debug] ${message}`);
        }
    }

    /**
     * Handles a TDS connection info output.
     * @listens tedious.Connection#info
     * @param {Object} info - The debugging information object. 
     * @private
     */
    _handleInfo(info) {
        if (this.config.debug) {
            this.log.debug(`[${this.id}][SQL Debug Info]`, info);
        }
    }

    /**
     * Disconnects from the database.
     * @emits disconnected
     * @returns {Promise.<Connection>}
     */
    async disconnect() {
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
        this._connected = false;
        this.log.debug(`[${this.id}] Disconnected from server "${this.config.server}".`);
        this.emit('disconnected', this);
        return this;
    }

}

module.exports = Connection;