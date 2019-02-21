/* eslint-disable no-console */

/**
 * This logging class utilizes 3 modes of logging: error, warn, and debug.
 * The mode can be set by specifying one of the modes in the `RHINO_LOGGING` environmental variable, or through a
 * `rhino` instance's `config.logging.mode` property.
 */
class Log {
    constructor(config) {

        /**
         * @type {LogConfiguration}
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