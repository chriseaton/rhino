
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

    /**
     * Flattens a and merges multiple results into either an array of `Result` or a single `Result` object if only one
     * result is discovered. If no `Result` instances are found, a `null` value is returned.
     * @param  {...Result|Array.<Result>} results - The results to flatten.
     * @returns {Result|Array.<Result>}
     */
    static flatten(...results) {
        let output = [];
        for (let r of results) {
            if (r) {
                if (Array.isArray(r)) {
                    output.push(...r.filter(r => !!r));
                } else {
                    output.push(r);
                }
            }
        }
        if (!output.length) {
            return null;
        }
        return (output.length > 1 ? output : output[0]);
    }

}

module.exports = Result;