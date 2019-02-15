const tedious = require('tedious');
const log = require('./log.js');

class Resource {
    constructor(tdsConfig) {

        this.config = tdsConfig;

        this.connection = null;

        this.connected = false;

    }

    async connect() {
        let self = this;
        return new Promise((resolve, reject) => {
            let conn = new tedious.Connection(self.config);
            conn.on('connect', () => {
                self._connected(conn);
                resolve(conn);
            });
            conn.on('end', this._disconnected.bind(this));
            conn.on('error', (err) => {
                if (reject) {
                    reject(err);
                }
                log.error(err);
            });
            if (tdsConfig.debug) {
                conn.on('debug', log.debug);
                conn.on('infoMessage', log.debug);
            }

        });
    }

    _connected(conn) {
        if (conn) {
            this.connection = conn;
        }
        this.connected = true;
        log.debug(`Connected to server "${this.config.server}".`);
    }

    _disconnected() {
        this.connected = false;
        log.debug(`Disconnected from server "${this.config.server}".`);
    }

}

module.exports = Resource;