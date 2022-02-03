const { TYPES: TDS_TYPES } = require('tedious');
const TDS_TYPE_KEYS = Object.keys(TDS_TYPES);
const TDS_DEPRECIATED_TYPE_KEYS = [
    'Null', 'IntN', 'BitN', 'FloatN', 'MoneyN', 'DateTimeN', 'DecimalN', 'NumericN',
    'DateN', 'DateTimeOffsetN', 'DateTime2N', 'TimeN', 'UniqueIdentifierN'
];
const UnicodeRegEx = /[^\u0000-\u00ff]/;
const GUIDRegEx = /^[{(]?[0-9A-F]{8}[-]?(?:[0-9A-F]{4}[-]?){3}[0-9A-F]{12}[)}]?$/i;

/**
 * @typedef Query.TDSType
 * @property {Number} id
 * @property {String} name
 * @property {String} type
 */

/**
 * @typedef Query.Parameter
 * @property {Boolean} output
 * @property {Query.TDSType} type
 * @property {*} value
 * @property {Object} options
 * @property {Number} options.length
 * @property {Number} options.precision
 * @property {Number} options.scale
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

        /**
         * The SQL statement.
         * @type {String}
         */
        this.statement = null;

        /**
         * The parameters and values to use on the query.
         * @type {Map.<String, Query.Parameter>}
         */
        this.params = new Map();

        /**
         * The query execution mode.
         */
        this.mode = Query.MODE.QUERY;

        /**
         * Command timeout value set for this query. A `null` value indicates the default will be used.
         * @type {Number}
         */
        this.requestTimeout = null;

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
            return TDS_TYPES.VarChar;
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
            return Query.AUTODETECT_TYPES.DATE;
        }
        throw new Error('Unable to determine TDS type from the specified "value" parameter argument.');
    }

    /**
     * Sets the SQL query request timeout.
     * @throws Error if the `ms` argument less than 0 or not a number (or `null`).
     * @param {Number} ms - The timeout in milliseconds, or `null` to use configured defaults.
     * @returns {Query}
     */
    timeout(ms) {
        if (ms !== null && (isNaN(ms) || ms < 0)) {
            throw new Error('The parameter "ms" argument must be a positive number greater than or equal to zero (0) or null.');
        }
        this.requestTimeout = ms;
        return this;
    }

    /**
     * Sets the SQL query text (statment). Calling this function resets the query `mode` to an automatically determined
     * value. 
     * @throws Error if the `statement` argument is falsey.
     * @throws Error if the `statement` argument is not a string.
     * @param {String} statement - The SQL query text to be executed.
     * @param {Map.<String,*>|Object} [params] - Optional parameters `Object` or `Map` that will be added to the
     * "in" parameters of the query. Keys and property names are used as the parameter name, and the value as the 
     * parameter values.
     * @returns {Query}
     */
    sql(statement, params) {
        if (!statement) {
            throw new Error('The parameter "statement" argument is required.');
        } else if (typeof statement != 'string') {
            throw new Error('The parameter "statement" argument must be a string type.');
        }
        if (statement.match(/^[\s;]*EXE(?:C|CUTE)?\s/i)) {
            this.mode = Query.MODE.EXEC;
            statement = statement.match(/^[\s;]*EXE(?:C|CUTE)?\s(.+)/i)[1]; //extract non-exec statement of stored procedure name.
        } else if (this.params.size === 0 && !!statement.match(/([^"']|"|'[^"']*["'])*?(;|\s\bGO\b)\s*\S/)) {
            this.mode = Query.MODE.BATCH;
        } else {
            this.mode = Query.MODE.QUERY;
        }
        this.statement = statement;
        //auto detect parameter direction, default to IN if unspecified
        if (params && (params instanceof Map || Array.isArray(params) || Object.keys(params).length)) {
            if (Array.isArray(params)) {
                for (let p of params && p) {
                    let dir = (p.output === true ? Query.PARAM_DIR.OUT : Query.PARAM_DIR.IN);
                    this.param(p.name, p.value, p.type, dir, p.options);
                }
            } else if (params instanceof Map) {
                for (let [k, v] of params) {
                    if (typeof v === 'object' && v && (v instanceof Date) === false && Buffer.isBuffer(v) === false) {
                        let dir = (v.output === true ? Query.PARAM_DIR.OUT : Query.PARAM_DIR.IN);
                        this.param(k, v.value, v.type, dir, v.options);
                    } else {
                        this.param(k, v, null, Query.PARAM_DIR.IN);
                    }
                }
            } else if (typeof params === 'object') {
                for (let p in params) {
                    if (typeof params[p] === 'object' && params[p] && (params[p] instanceof Date) === false && Buffer.isBuffer(params[p]) === false) {
                        let dir = (params[p].output === true ? Query.PARAM_DIR.OUT : Query.PARAM_DIR.IN);
                        this.param(p, params[p].value, params[p].type, dir, params[p].options);
                    } else {
                        this.param(p, params[p], null, Query.PARAM_DIR.IN);
                    }
                }
            }
        }
        return this;
    }

    /**
     * Forces the query into BATCH `mode`. 
     * @throws Error if the query contains parameters.
     * @returns {Query}
     */
    batch() {
        if (this.params.size > 0) {
            throw new Error(`The query cannot be set to BATCH mode when query parameters are present: ${this.params.size} parameters were declared.`);
        }
        this.mode = Query.MODE.BATCH;
        return this;
    }

    /**
     * Forces the query into EXEC `mode`.
     * @returns {Query}
     */
    exec() {
        this.mode = Query.MODE.EXEC;
        return this;
    }

    /**
     * Adds or updates a parameter for the query.    
     * Calling this when the query `mode` is set to BATCH will reset the `mode` to QUERY.
     * @throws Error if the `name` argument is falsey.
     * @throws Error if the `name` argument is not a string.
     * @throws Error if the `name` argument has already been specified or is not specified as a string.
     * @throws Error if the `type` and `value` arguments are not specified or falsey when the direction is out.
     * @param {String} name - The parameter name, can be specified with the '@' character or not.
     * @param {String|Number|Date|Buffer|Object|*} [value=null] - The value of the parameter.
     * @param {String|Query.TDSType} [type] - The explicit database type to use, if not specified, it is
     * auto-determined.
     * @param {Query.PARAM_DIR} [dir=Query.PARAM_DIR.IN] - The direction of the parameter.
     * @param {*} [options] - Any additional `tedious` parameter options.
     * @returns {Query}
     */
    param(name, value, type, dir = Query.PARAM_DIR.IN, options) {
        //validate
        if (!name) {
            throw new Error('A parameter "name" argument is required.');
        } else if (typeof name !== 'string') {
            throw new Error('The "name" argument must be a String.');
        } else if (dir === Query.PARAM_DIR.OUT && (typeof type === 'undefined' || type === null) && typeof value === 'undefined') {
            throw new Error('The "type" or "value" arguments must be specified if the parameter direction is out.');
        }
        //strip an '@' from the name if specified.
        if (name && name.length && name[0] === '@') {
            name = name.substring(1);
        }
        if (typeof name !== 'string') {
            throw new Error('A parameter "name" argument must be a string.');
        }
        //reset mode if necessary 
        if (this.mode === Query.MODE.BATCH) {
            this.mode = Query.MODE.QUERY;
        }
        //build the parameter object
        let p = {
            output: (dir === Query.PARAM_DIR.OUT),
            type: (type ? this._getTDSType(type) : null),
        };
        if (dir === Query.PARAM_DIR.OUT) {
            if (typeof value !== 'undefined') {
                p.value = value;
            }
        } else {
            p.value = (typeof value !== 'undefined' ? value : null);
        }
        //detect type if not already specified and a value is provided.
        if (!p.type && typeof p.value !== 'undefined' && p.value !== null) {
            p.type = this._detectType(value);
        }
        if (!p.type) {
            p.type = Query.TYPE.VarChar; //fallback to varchar if undetermined.
        }
        //add the parameter
        this.params.set(name, p);
        return this;
    }

    /**
     * @typedef SQLParameter
     * @param {*} value 
     * @param {Query.TDSType} type 
     * @param {{length: Number, precision: Number, scale: Number}} options 
     */

    /**
     * Adds an input parameter to the query.    
     * Calling this when the query `mode` is set to BATCH will reset the `mode` to QUERY.
     * @throws Error if the `name` argument is falsey.
     * @throws Error if the `name` argument is not a string.
     * @throws Error if the `name` argument has already been specified or is not specified as a string.
     * @param {String|Map.<String,SQLParameter>|Array.<SQLParameter>|Object} name - A number of options for 
     * specifying the parameter, either giving the name, or giving a Map, Array, or object.    
     * If a Map, Array or object is specified, the other arguments are ignored.
     * @param {String|Number|Date|Buffer|Object|*} [value=null] - The value of the parameter.
     * @param {String|Query.TDSType} [type] - The explicit database type to use, if not specified, it is 
     * auto-determined.
     * @param {*} [options] - Any additional `tedious` parameter options.
     * @returns {Query}
     */
    in(name, value, type, options) {
        if (arguments.length === 1) {
            if (Array.isArray(name)) {
                for (let p of name) {
                    this.param(p.name, p.value, p.type, Query.PARAM_DIR.IN, p.options);
                }
            } else if (name instanceof Map) {
                for (let [k, v] of name) {
                    if (typeof v === 'object' && v && (v instanceof Date) === false && Buffer.isBuffer(v) === false) {
                        this.param(k, v.value, v.type, Query.PARAM_DIR.IN, v.options);
                    } else {
                        this.param(k, v, null, Query.PARAM_DIR.IN);
                    }
                }
            } else if (typeof name === 'object') {
                for (let p in name) {
                    if (typeof name[p] === 'object' && name[p] && (name[p] instanceof Date) === false && Buffer.isBuffer(name[p]) === false) {
                        this.param(p, name[p].value, name[p].type, Query.PARAM_DIR.IN, name[p].options);
                    } else {
                        this.param(p, name[p], null, Query.PARAM_DIR.IN);
                    }
                }
            } else {
                throw new Error('Invalid "name" argument, the value of "name" must be an Object, Array, or Map when no other arguments are specified.');
            }
        } else {
            this.param(name, value, type, Query.PARAM_DIR.IN, options);
        }
        return this;
    }

    /**
     * Adds an output parameter to the query.    
     * Calling this when the query `mode` is set to BATCH will reset the `mode` to QUERY.
     * @throws Error if the `name` argument is falsey.
     * @throws Error if the `name` argument is not a string.
     * @throws Error if the `name` argument has already been specified or is not specified as a string.
     * @param {String|Map.<String,SQLParameter>|Array.<SQLParameter>|SQLParameter} name - A number of options for 
     * specifying the parameter, either giving the name, or giving a Map, Array, or single instance of 
     * the SQLParameter object. If a Map, Array or SQLParameter is specified, the other arguments are ignored.
     * @param {String|Number|Date|Buffer|Object|*} [value] - The value of the parameter.
     * @param {String|Query.TDSType} [type] - The explicit database type to use, if not specified, it is 
     * auto-determined.
     * @param {*} [options] - Any additional `tedious` parameter options.
     * @returns {Query}
     */
    out(name, value, type, options) {
        if (arguments.length === 1) {
            if (Array.isArray(name)) {
                for (let p of name) {
                    this.param(p.name, p.value, p.type, Query.PARAM_DIR.OUT, p.options);
                }
            } else if (name instanceof Map) {
                for (let [k, v] of name) {
                    if (typeof v === 'object' && v && (v instanceof Date) === false && Buffer.isBuffer(v) === false) {
                        this.param(k, v.value, v.type, Query.PARAM_DIR.OUT, v.options);
                    } else {
                        this.param(k, v, null, Query.PARAM_DIR.OUT);
                    }
                }
            } else if (typeof name === 'object') {
                for (let p in name) {
                    if (typeof name[p] === 'object' && name[p] && (name[p] instanceof Date) === false && Buffer.isBuffer(name[p]) === false) {
                        this.param(p, name[p].value, name[p].type, Query.PARAM_DIR.OUT, name[p].options);
                    } else {
                        this.param(p, name[p], null, Query.PARAM_DIR.OUT);
                    }
                }
            } else {
                throw new Error('Invalid "name" argument, the value of "name" must be an Object, Array, or Map when no other arguments are specified.');
            }
        } else {
            this.param(name, value, type, Query.PARAM_DIR.OUT, options);
        }
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
        this.mode = Query.MODE.QUERY;
        this.params.clear();
    }

}

/**
 * The parameter direction. Defaults to 'IN'.
 * @enum {String}
 */
Query.PARAM_DIR = {
    IN: 'in',
    OUT: 'out'
};

/**
 * The mode that determines how the query should be executed.
 * @enum {Number}
 */
Query.MODE = {
    /** 
     * Indicates the query should be run using the `execSql` function. This is the most common mode that supports 
     * parameters.
     */
    QUERY: 0,
    /**
     * This mode indicates the query should run using the `execSqlBatch` function. This mode does not support
     * parameters and is meant for multi-statement queries.
     */
    BATCH: 1,
    /**
     * This mode indicates the query is a stored procedure call, and is executed using the `callProcedure` function.
     */
    EXEC: 2
};

/**
 * @typedef QueryTypes
 * @property {Query.TDSType} TinyInt
 * @property {Query.TDSType} Bit
 * @property {Query.TDSType} SmallInt
 * @property {Query.TDSType} Int
 * @property {Query.TDSType} SmallDateTime
 * @property {Query.TDSType} Real
 * @property {Query.TDSType} Money
 * @property {Query.TDSType} DateTime
 * @property {Query.TDSType} Float
 * @property {Query.TDSType} Decimal
 * @property {Query.TDSType} Numeric
 * @property {Query.TDSType} SmallMoney
 * @property {Query.TDSType} BigInt
 * @property {Query.TDSType} Image
 * @property {Query.TDSType} Text
 * @property {Query.TDSType} UniqueIdentifier
 * @property {Query.TDSType} NText
 * @property {Query.TDSType} VarBinary
 * @property {Query.TDSType} VarChar
 * @property {Query.TDSType} Binary
 * @property {Query.TDSType} Char
 * @property {Query.TDSType} NVarChar
 * @property {Query.TDSType} NChar
 * @property {Query.TDSType} Xml
 * @property {Query.TDSType} Time
 * @property {Query.TDSType} Date
 * @property {Query.TDSType} DateTime2
 * @property {Query.TDSType} DateTimeOffset
 * @property {Query.TDSType} UDT
 * @property {Query.TDSType} TVP
 * @property {Query.TDSType} Variant
 */

/**
 * TDS column types.
 * @type {QueryTypes}
 */
Query.TYPE = {};
for (let tk of TDS_TYPE_KEYS) {
    if (TDS_DEPRECIATED_TYPE_KEYS.indexOf(tk) < 0 || !!process.env.RHINO_DEPRECIATED_TYPES) {
        Query.TYPE[tk] = TDS_TYPES[tk];
    }
}

/**
 * Auto-detection types used when a type is not specifically detected, but a 
 * value is provided. Only certain types can be configured.
 */
Query.AUTODETECT_TYPES = {
    /** 
     * The TDS type used when a floating point number value is detected. 
     * Defaults to `Float`.
     */
    FLOATING_POINT: TDS_TYPES.Float,
    /** 
     * The TDS type used when a Date object value is detected.
     * Defaults to `DateTimeOffset`.
     */
    DATE: TDS_TYPES.DateTimeOffset,
    /** 
     * The TDS type used when a Buffer object value is detected. 
     * Defaults to `VarBinary`.
     */
    BUFFER: TDS_TYPES.VarBinary
};

module.exports = Query;