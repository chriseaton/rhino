const TDS_TYPES = require('tedious').TYPES;
const TDS_TYPE_KEYS = Object.keys(TDS_TYPES);
const UnicodeRegEx = /[^\u0000-\u00ff]/;
const GUIDRegEx = /^[{(]?[0-9A-F]{8}[-]?(?:[0-9A-F]{4}[-]?){3}[0-9A-F]{12}[)}]?$/i;

/**
 * @typedef Query.TDSType
 * @property {Number} id
 * @property {String} name
 * @property {String} type
 */

/**
 * Wraps a SQL query and provides helper functions for managing parameters.
 * 
 * @example
 * The following example shows how to build a query for use in Rhino.
 * ```js
 * let q = Query
 *          .sql(`SELECT @valid=IsCustomer 
 *                FROM contacts 
 *                WHERE name LIKE @firstName AND account = @number`)
 *          .in('firstName', 'John')
 *          .in('account', Query.TYPE.INT, 23494893)
 *          .out('valid', Query.TYPE.BIT);
 * //remove a parameter by name
 * q.remove('account');
 * //reset everything
 * q.clear();
 * ```
 */
class Query {
    /**
     * Creates a new instance of the `Query` class.
     */
    constructor() {

        this.statement = null;

        this.params = new Map();

        this.exec = false;

    }

    /**
     * Returns the matching TDS type object matching the specified type object or id.
     * @throws Error if the `type` argument is falsey.
     * @param {String|Query.TDSType} type - The type to be matched.
     * @returns {Query.TDSType}
     * @private
     */
    _getTDSType(type) {
        if (!type) {
            throw new Error('The parameter "type" argument is required.');
        }
        for (let k of TDS_TYPE_KEYS) {
            if (type.id && type.name) {
                if (type.id === TDS_TYPES[k].id) {
                    return TDS_TYPES[k];
                }
            } else if (k.toLowerCase() === type.toLowerCase()) {
                return TDS_TYPES[k];
            }
        }
        throw new Error(`The parameter "type" argument value "${type}" is not a valid or supported TDS type.`);
    }

    /**
     * Detects the SQL type from the given value.
     * @param {*} value - The value to detect a TDS type from.
     * @returns {Query.TDSType}
     * @private 
     */
    _detectType(value) {
        let vt = typeof value;
        if (vt === 'undefined' || value === null) {
            return TDS_TYPES.Null;
        } else if (vt === 'string') {
            if (UnicodeRegEx.test(value)) {
                return TDS_TYPES.NVarChar;
            } else if (GUIDRegEx.test(value)) {
                return TDS_TYPES.UniqueIdentifier;
            }
            return TDS_TYPES.VarChar;
        } else if (vt === 'boolean') {
            return TDS_TYPES.Bit;
        } else if (vt === 'number') {
            if (value % 1 !== 0) {
                return Query.AUTODETECT_TYPES.FLOATING_POINT;
            } else if (value >= 0 && value <= 255) {
                return TDS_TYPES.TinyInt;
            } else if (value >= -32767 && value <= 32767) {
                return TDS_TYPES.SmallInt;
            } else if (value >= -2147483647 && value <= 2147483647) {
                return TDS_TYPES.Int;
            } else if (value < -2147483647 || value > 2147483647) {
                return TDS_TYPES.BigInt;
            }
        } else if (Buffer.isBuffer(value)) {
            return Query.AUTODETECT_TYPES.BUFFER;
        } else if (value instanceof Date) {
            return Query.AUTODETECT_TYPES.DATETIME;
        }
        throw new Error('Unable to determine TDS type from the specified "value" parameter argument.');
    }

    /**
     * Sets the SQL query text (statment).
     * @throws Error if the `statement` argument is falsey.
     * @throws Error if the `statement` argument is not a string.
     * @param {String} statement - The SQL query text to be executed.
     * @returns {Query}
     */
    sql(statement) {
        if (!statement) {
            throw new Error('The parameter "statement" argument is required.');
        } else if (typeof statement != 'string') {
            throw new Error('The parameter "statement" argument must be a string type.');
        } else if (statement) {
            this.exec = !!statement.match(/^[\s;]*EXEC/i);
        }
        this.statement = statement;
        return this;
    }

    /**
     * Adds an input parameter to the query.
     * @throws Error if the `name` argument is falsey.
     * @throws Error if the `name` argument is not a string.
     * @throws Error if the `name` argument has already been specified or is not specified as a string.
     * @param {String} name - The parameter name, can be specified with the '@' character or not.
     * @param {String|Query.TDSType} [type] - The explicit database type to use, if not specified, it is auto-determined. This parameter
     * can be omitted.
     * @param {String|Number|Date|Buffer|Object|*} [value=null] - The value of the parameter.
     * @returns {Query}
     */
    in(name, type, value) {
        //strip an '@' from the name if specified.
        if (name && name.length && name[0] === '@') {
            name = name.substr(1);
        }
        //validate
        if (!name) {
            throw new Error('A parameter "name" argument is required.');
        } else if (typeof name !== 'string') {
            throw new Error('A parameter "name" argument must be a string.');
        } else if (this.params.has(name)) {
            throw new Error(`The parameter "name" argument "${name}" already exists in the query's parameter map.`);
        }
        //check if the type has been ommitted.
        if (arguments.length === 2 && !(type && type.id && type.name && type.type)) {
            value = type;
            type = null;
        }
        //convert a value of undefined to null
        if (typeof value === 'undefined') {
            value = null;
        }
        //add the parameter
        this.params.set(name, {
            output: false,
            type: (type ? this._getTDSType(type) : this._detectType(value)),
            value: value
        });
        return this;
    }

    /**
     * Adds an output parameter to the query.
     * @throws Error if the `name` argument is falsey.
     * @throws Error if the `name` argument is not a string.
     * @throws Error if the `name` argument has already been specified or is not specified as a string.
     * @throws Error if the `type` argument is falsey.
     * @param {String} name - The parameter name, can be specified with the '@' character or not.
     * @param {*} type - The explicit database type to use. Must be specified on out parameters.
     * @returns {Query}
     */
    out(name, type) {
        //strip an '@' from the name if specified.
        if (name && name.length && name[0] === '@') {
            name = name.substr(1);
        }
        //validate
        if (!name) {
            throw new Error('A parameter "name" argument is required.');
        } else if (typeof name !== 'string') {
            throw new Error('A parameter "name" argument must be a string.');
        } else if (this.params.has(name)) {
            throw new Error(`The parameter "name" argument "${name}" already exists in the query's parameter map.`);
        } else if (!type) {
            throw new Error('A parameter "type" argument is required.');
        }
        this.params.set(name, {
            output: true,
            type: this._getTDSType(type)
        });
        return this;
    }

    /**
     * Removes a parameter by name.
     * @throws Error if the `name` argument is falsey.
     * @throws Error if the `name` argument is not a string.
     * @param {String} name - The name of the parameter to remove.
     * @returns {Boolean} Returns `true` if a parameter with the name was found and removed, or `false` if no parameter
     * was found with the given name.
     */
    remove(name) {
        if (!name) {
            throw new Error('A parameter "name" argument is required.');
        } else if (typeof name !== 'string') {
            throw new Error('A parameter "name" argument must be a string.');
        }
        return this.params.delete(name);
    }

    /**
     * Clears all query criteria, including SQL statement values and parameters. The `Query` instance is fully reset
     * to a blank slate.
     */
    clear() {
        this.statement = null;
        this.exec = false;
        this.params.clear();
    }

}

/**
 * TDS column types.
 */
Query.TYPE = TDS_TYPES;

/**
 * Auto-detection types used when a type is not specifically detected, but a 
 * value is provided. Only certain types can be configured.
 */
Query.AUTODETECT_TYPES = {
    /** The TDS type used when a floating point number value is detected. */
    FLOATING_POINT: TDS_TYPES.Float,
    /** The TDS type used when a Date object value is detected. */
    DATETIME: TDS_TYPES.DateTimeOffset,
    /** The TDS type used when a Buffer object value is detected. */
    BUFFER: TDS_TYPES.VarBinary
};

module.exports = Query;