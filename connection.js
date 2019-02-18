const crypto = require('crypto');
const tedious = require('tedious');
const Log = require('./log.js');

class Connection {
    constructor(tdsConfig, log) {

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
         * The working tedious connection.
         * @type {tedious.Connection}
         * @private
         */
        this._tdsConnection = null;
    }

    /**
     * Flag indicating whether the connection is valid and alive.
     * @type {Boolean}
     */
    get connected() {
        return this._connected;
    }

    /**
     * Randomly generated connection identifier string.
     * @type {String}
     */
    get id() {
        return this._id;
    }

    /**
     * Connects to the database.
     * @returns {Promise.<Resource>}
     */
    connect() {
        let self = this;
        return new Promise((resolve, reject) => {
            let conn = new tedious.Connection(self.config);
            conn.on('connect', (err) => {
                if (err) {
                    reject(err);
                } else {
                    self._onConnected(conn);
                    resolve(self);
                }
            });
            conn.on('end', self._onDisconnected.bind(self));
            conn.on('error', (err) => {
                if (reject) {
                    reject(err);
                }
                self.log.error(err);
            });
            if (self.config.debug) {
                conn.on('debug', self.log.debug);
                conn.on('infoMessage', self.log.debug);
            }
        });
    }

    disconnect() {
        if (this._connection) {
            this._connection.close();
            this._onDisconnected();
        }
    }

    _onConnected(conn) {
        if (conn) {
            this._connection = conn;
        }
        if (!this._connected) {
            this._connected = true;
            this.log.debug(`[${this.id}] Connected to server "${this.config.server}".`);
        }
    }

    _onDisconnected() {
        if (this._connected) {
            this._connected = false;
            this.log.debug(`[${this.id}] Disconnected from server "${this.config.server}".`);
        }
    }

}

module.exports = Connection;