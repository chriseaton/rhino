const genericPool = require("generic-pool");
const log = require('./log.js');
const Resource = require('./resource.js');
const Transaction = require('./transaction.js');

class Rhino {
    constructor(config) {

        /**
         * @type {*}
         */
        this.config = config || {};

        /**
         * @type {genericPool.Pool}
         * @private
         */
        this._pool = this._createPool(config.pool);

    }

    /**
     * Creates a new instance of a rhino pool.
     * @param {*} config 
     * @returns {Rhino}
     */
    static create(config) {
        return new Rhino(config);
    }

    /**
     * Creates a `genericPool.Pool` instance meant for internal use by the active `Rhino` instance. 
     * @param {genericPool.Options} config
     * @returns {genericPool.Pool} 
     * @private
     */
    _createPool(config) {
        config = Object.assign({
            min: 0,
            max: 10
        }, config, {
                autostart: true
            });
        return genericPool.createPool({
            create: this._createResource.bind(this),
            destroy: this._destroyResource.bind(this),
            validate: this._validateResource.bind(this)
        }, config);
    }

    async _createResource() {
        let r = new Resource();
        await r.connect(this.config);
        return r;
    }

    async _destroyResource(resource) {

    }

    async _validateResource(resource) {

    }

    async transaction() {
        let res = await this._pool.acquire();
        return new Transaction(res);
    }

    async query(sql, ...parameters) {
        let res = await this._pool.acquire();
    }

}

module.exports = Rhino;