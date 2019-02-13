const genericPool = require("generic-pool");
const Transaction = require('./transaction.js');

class Rhino {
    constructor(config) {

        this.config = config || {};

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
            create: this._poolCreate,
            destroy: this._poolDestroy,
            validate: this._poolValidate
        }, config);
    }

    _poolCreate() {

    }

    _poolDestroy(resource) {

    }

    _poolValidate(resource) {

    }

    async transaction() {
        let conn = await this._pool.acquire();
        return new Transaction(conn);
    }

    async query(sql, ...parameters) {

    }

}

module.exports = Rhino;