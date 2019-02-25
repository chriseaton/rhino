/* eslint-disable no-console */

/**
 * @typedef Log.LogConfiguration
 * @property {Boolean|String} mode - Can be 'none', 'error', 'warn', or 'debug for enabled logging levels. A falsey
 * value will disable logging. A truthy value that is not a string will assume 'warn' mode.
 * @property {Boolean} [connections=false] - Flag that indicates whether to log connection state messages. These 
 * messages are entered on the debug log.
 * @property {Boolean} [tds=false] - Indicates whether to log debug and info messages from underlying TDS connections.
 * These messages are entered on the debug log.
 */

/**
 * This logging class utilizes 3 modes of logging: error, warn, and debug.
 * The mode can be set by specifying one of the modes in the `RHINO_LOGGING` environmental variable, or through a
 * `rhino` instance's `config.logging.mode` property.
 */
class Log {
    constructor(config) {

        /**
         * @type {Log.LogConfiguration}
         */
        this.config = config || {};

        //ensure mode is a string
        if (this.config.mode) {
            if (typeof this.config.mode !== 'string') {
                this.config.mode = 'warn';
            } else if (this.config.mode === 'none') {
                this.config.mode = false;
            }
        }
    }

    /**
     * Logs an error to the configured error function, or if not specifed, to the `console.error`.
     */
    error() {
        if (this.config && this.config.mode) {
            if (this.config.error) {
                this.config.error.apply(null, arguments);
            } else {
                console.error.apply(null, arguments);
            }
        }
    }

    /**
     * Logs a warning message to the configured warn function, or if not specifed, to the `console.warn`.
     */
    warn() {
        if (this.config && this.config.mode && this.config.mode !== 'error') {
            if (this.config.warn) {
                this.config.warn.apply(null, arguments);
            } else {
                console.warn.apply(null, arguments);
            }
        }
    }

    /**
     * Logs a debug message to the configured debug function, or if not specifed, to the `console.debug`.
     */
    debug() {
        if (this.config && this.config.mode && this.config.mode === 'debug') {
            if (this.config.debug) {
                this.config.debug.apply(null, arguments);
            } else {
                console.debug.apply(null, arguments);
            }
        }
    }
}

module.exports = Log;