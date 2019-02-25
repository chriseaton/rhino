
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

    sql(statement) {
        if (statement) {
            this.exec = !!statement.match(/^[\s;]*EXEC/i);
        }
        this.statement = statement;
        return this;
    }

    /**
     * Adds an input parameter to the query.
     * @throws Error if the name has already been specified or is not specified as a string.
     * @param {String} name - The parameter name, can be specified with the '@' character or not.
     * @param {*} [type] - The explicit database type to use, if not specified, it is auto-determined. This parameter
     * can be omitted.
     * @param {String|Number|Date|Buffer|Object|*} [value=null] - The value of the parameter.
     * @returns {Query}
     */
    in(name, type, value) {
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
        this.params.set(name, {
            output: false,
            type: type || this._detectType(value),
            value: value
        });
        return this;
    }

    /**
     * Adds an output parameter to the query.
     * @throws Error if the name has already been specified or is not specified as a string.
     * @throws Error if the type is not specified.
     * @param {String} name - The parameter name, can be specified with the '@' character or not.
     * @param {*} type - The explicit database type to use. Must be specified on out parameters.
     * @returns {Query}
     */
    out(name, type) {
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
            type: type
        });
        return this;
    }

    /**
     * Removes a parameter by name.
     * @param {String} name - The name of the parameter to remove.
     * @returns {Boolean} Returns `true` if a parameter with the name was found and removed, or `false` if no parameter
     * was found with the given name.
     */
    remove(name) {
        return this.params.delete(name);
    }

    /**
     * Clears all query criteria, including SQL statement values and parameters. The `Query` instance is fully reset
     * to a blank slate.
     */
    clear() {
        this.sql = null;
        this.params.clear();
    }

}

module.exports - Query;