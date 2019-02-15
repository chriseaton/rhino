
let config = null;

module.exports = {
    configure: function (logging) {
        config = logging || null;
    },
    error: function () {
        if (config && config.enabled) {
            if (config.error) {
                config.error.apply(null, arguments);
            } else {
                console.error.apply(null, arguments);
            }
        }
    },
    warn: function () {
        if (config && config.enabled) {
            if (config.warn) {
                config.warn.apply(null, arguments);
            } else {
                console.warn.apply(null, arguments);
            }
        }
    },
    debug: function () {
        if (config && config.enabled) {
            if (config.debug) {
                config.debug.apply(null, arguments);
            } else {
                console.debug.apply(null, arguments);
            }
        }
    }
}