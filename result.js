
class Result {
    constructor() {

        /**
         * The return value from a stored procedure call (or series of calls).
         * @type {*|Array.<*>}
         */
        this.returned = null;

        /**
         * Array of column metadata. This will always be an array of columns even when the options `useColumnNames` is
         * used.
         * @type {Array}
         */
        this.columns = [];
        
        /**
         * Array of row data. If the `useColumnNames` config option is true, each row will be an object with keys and
         * values corresponding to column names and values. If `useColumnNames` is false, each row will be an array
         * of values with indexes aligned with the `columns` metadata array.
         * @type {Array.<Object>|Array.<Array>}
         */
        this.rows = [];

    }

}

module.exports = Result;