const Query = require('./query.js');
const TDS_TYPES = require('tedious').TYPES;
require('jest');

describe('#sql', () => {
    test('throws on falsey @statement.', () => {
        let q = new Query();
        expect(() => q.sql('')).toThrow('statement');
        expect(() => q.sql()).toThrow('statement');
        expect(() => q.sql(false)).toThrow('statement');
        expect(() => q.sql(0)).toThrow('statement');
    });
    test('throws on non-string @statement.', () => {
        let q = new Query();
        expect(() => q.sql([])).toThrow('statement');
        expect(() => q.sql(new Date())).toThrow('statement');
        expect(() => q.sql(true)).toThrow('statement');
        expect(() => q.sql(1234)).toThrow('statement');
    });
    test('sets the query statement property.', () => {
        let q = new Query();
        q.sql('SELECT 1');
        expect(q.statement).toBe('SELECT 1');
        q.sql('SELECT 2');
        expect(q.statement).toBe('SELECT 2');
    });
    test('sets the query mode property', () => {
        let q = new Query();
        q.sql('SELECT 1');
        expect(q.mode).toBe(Query.MODE.QUERY);
        q.sql('EXEC dbo.sp_SomeSproc;');
        expect(q.mode).toBe(Query.MODE.EXEC);
        q.sql('UPDATE dbo.tbl1 SET id = 1;');
        expect(q.mode).toBe(Query.MODE.QUERY);
        q.sql('ExeCute dbo.MoreSprocs;');
        expect(q.mode).toBe(Query.MODE.EXEC);
        q.sql('\t ;ExeCute dbo.MoreSprocs;');
        expect(q.mode).toBe(Query.MODE.EXEC);
        q.sql('\tUPDATE dbo.tbl1 SET id = 1 ;ExeCute dbo.MoreSprocs;');
        expect(q.mode).toBe(Query.MODE.BATCH);
        q.sql('SELECT 1\nGO\nSELECT 2');
        expect(q.mode).toBe(Query.MODE.BATCH);
    });
    test('Removes the EXEC from an sproc call.', () => {
        let c = new Query();
        expect(c.sql('EXEC sp_123').statement).toBe('sp_123');
        expect(c.sql('EXEC dbo.sp_123').statement).toBe('dbo.sp_123');
        //negative test
        expect(c.sql('EXEC.dbo.sp_123').mode).toBe(Query.MODE.QUERY);
        expect(c.sql('EXEC.dbo.sp_123').statement).toBe('EXEC.dbo.sp_123');
    });
    test('returns the Query instance.', () => {
        let c = new Query();
        expect(c.sql('EXEC sp_123')).toBe(c);
        expect(new Query().sql('SELECT 1')).toBeInstanceOf(Query);
    });
    test('calling with @params object adds "in" parameters.', () => {
        let q = new Query();
        q.sql('SELECT @a, @b, @c;', { a: 1, b: 2, c: true });
        expect(q.params.size).toBe(3);
        expect(q.params.get('a').value).toBe(1);
        expect(q.params.get('b').value).toBe(2);
        expect(q.params.get('c').value).toBe(true);
    });
    test('calling with @params map adds "in" parameters.', () => {
        let q = new Query();
        let m = new Map();
        m.set('a', 1);
        m.set('b', 2);
        m.set('c', true);
        q.sql('SELECT @a, @b, @c;', m);
        expect(q.params.size).toBe(3);
        expect(q.params.get('a').value).toBe(1);
        expect(q.params.get('b').value).toBe(2);
        expect(q.params.get('c').value).toBe(true);
    });
});

describe('#in', () => {
    test('throws when the @name is falsey.', () => {
        let q = new Query();
        expect(() => q.in('')).toThrow(/name.+required/);
        expect(() => q.in()).toThrow(/name.+required/);
        expect(() => q.in(false)).toThrow(/name.+required/);
        expect(() => q.in(0)).toThrow(/name.+required/);
    });
    test('throws when the @name a map without string keys.', () => {
        let q = new Query();
        let m = new Map();
        m.set(true, 123);
        expect(() => q.out(m)).toThrow(/name.+string/);
    });
    test('throws when a param with the same @name has been added.', () => {
        let q = new Query();
        q.in('test', 1);
        expect(() => q.in('test', 2)).toThrow('name');
        expect(() => q.in('Test', 2)).not.toThrow('name');
    });
    test('strips the "@" from the @name value.', () => {
        expect(new Query().in('@abc', 123).params.has('abc')).toBe(true);
        expect(new Query().in('abc', 123).params.has('@abc')).toBe(false);
    });
    test('detects proper auto-detectable types.', () => {
        let c = new Query();
        expect(c.in('test1', null).params.get('test1').type).toBe(Query.TYPE.VarChar);
        expect(c.in('test2').params.get('test2').type).toBe(Query.TYPE.VarChar);
        expect(c.in('test3', '').params.get('test3').type).toBe(Query.TYPE.VarChar);
        expect(c.in('test4', 'abc').params.get('test4').type).toBe(Query.TYPE.VarChar);
        expect(c.in('test5', '(╯°□°）╯︵ ┻━┻').params.get('test5').type).toBe(Query.TYPE.NVarChar);
        expect(c.in('test6a', 'f2049fcda93f940919ac00a933919341').params.get('test6a').type).toBe(Query.TYPE.UniqueIdentifier);
        expect(c.in('test6b', 'f2049fcd-a93f-9409-19ac-00a933919341').params.get('test6b').type).toBe(Query.TYPE.UniqueIdentifier);
        expect(c.in('test6c', '{F2049FCD-A93F-9409-19AC-00A933919341}').params.get('test6c').type).toBe(Query.TYPE.UniqueIdentifier);
        expect(c.in('test7', false).params.get('test7').type).toBe(Query.TYPE.Bit);
        expect(c.in('test8', true).params.get('test8').type).toBe(Query.TYPE.Bit);
        expect(c.in('test9', 0.1).params.get('test9').type).toBe(Query.TYPE.Float);
        expect(c.in('test10', 1).params.get('test10').type).toBe(Query.TYPE.TinyInt);
        expect(c.in('test11', 3223).params.get('test11').type).toBe(Query.TYPE.SmallInt);
        expect(c.in('test12', 2390492).params.get('test12').type).toBe(Query.TYPE.Int);
        expect(c.in('test13', 909904304394).params.get('test13').type).toBe(Query.TYPE.BigInt);
    });
    test('converts string types to matching TDS type objects.', () => {
        let c = new Query();
        let typeKeys = Object.keys(Query.TYPE);
        for (let x = 0; x < typeKeys.length; x++) {
            c.in('test' + x, typeKeys[x].toUpperCase(), 123);
            expect(c.params.get('test' + x).type).toBe(Query.TYPE[typeKeys[x]]);
        }
    });
    test('returns the Query instance.', () => {
        let c = new Query();
        expect(c.in('abc', 123)).toBe(c);
        let typeKeys = Object.keys(Query.TYPE);
        for (let x = 0; x < typeKeys.length; x++) {
            expect(c.in('test' + x, Query.TYPE[typeKeys[x]], 123)).toBe(c);
        }
    });
    test('sets the proper output flag of false.', () => {
        expect(new Query().in('abc', 123).params.get('abc').output).toBe(false);
    });
    test('adds multiple parameters by object.', () => {
        let q = new Query();
        q.in({ a: 1, b: 2, c: 3 }, Query.TYPE.BigInt);
        expect(q.params.has('a')).toBeTruthy();
        expect(q.params.get('a').type).toBe(Query.TYPE.BigInt);
        expect(q.params.get('a').value).toBe(1);
        expect(q.params.has('b')).toBeTruthy();
        expect(q.params.get('b').type).toBe(Query.TYPE.BigInt);
        expect(q.params.get('b').value).toBe(2);
        expect(q.params.has('c')).toBeTruthy();
        expect(q.params.get('c').type).toBe(Query.TYPE.BigInt);
        expect(q.params.get('c').value).toBe(3);
        expect(q.params.has('d')).toBeFalsy();
    });
    test('adds multiple parameters by Map.', () => {
        let q = new Query();
        let m = new Map();
        m.set('a', 1);
        m.set('b', 2);
        m.set('c', 3);
        q.in(m, Query.TYPE.BigInt);
        expect(q.params.has('a')).toBeTruthy();
        expect(q.params.get('a').type).toBe(Query.TYPE.BigInt);
        expect(q.params.get('a').value).toBe(1);
        expect(q.params.has('b')).toBeTruthy();
        expect(q.params.get('b').type).toBe(Query.TYPE.BigInt);
        expect(q.params.get('b').value).toBe(2);
        expect(q.params.has('c')).toBeTruthy();
        expect(q.params.get('c').type).toBe(Query.TYPE.BigInt);
        expect(q.params.get('c').value).toBe(3);
        expect(q.params.has('d')).toBeFalsy();
    });
});

describe('#out', () => {
    test('throws when the @name is falsey.', () => {
        let q = new Query();
        expect(() => q.out('')).toThrow(/name.+required/);
        expect(() => q.out()).toThrow(/name.+required/);
        expect(() => q.out(false)).toThrow(/name.+required/);
        expect(() => q.out(0)).toThrow(/name.+required/);
    });
    test('throws when the @name a map without string keys.', () => {
        let q = new Query();
        let m = new Map();
        m.set(true, 123);
        expect(() => q.out(m)).toThrow(/name.+string/);
    });
    test('throws when the @type is falsey.', () => {
        let q = new Query();
        expect(() => q.out('test')).toThrow('type');
        expect(() => q.out('test', null)).toThrow('type');
        expect(() => q.out('test', undefined)).toThrow('type');
        expect(() => q.out('test', false)).toThrow('type');
    });
    test('throws when a param with the same @name has been added.', () => {
        let q = new Query();
        q.out('test', Query.TYPE.VarBinary);
        expect(() => q.out('test', Query.TYPE.DateTimeOffset)).toThrow('name');
        expect(() => q.out('Test', Query.TYPE.NChar)).not.toThrow('name');
    });
    test('strips the "@" from the @name value.', () => {
        expect(new Query().out('@abc', Query.TYPE.Char).params.has('abc')).toBe(true);
        expect(new Query().out('abc', Query.TYPE.BigInt).params.has('@abc')).toBe(false);
    });
    test('converts string types to matching TDS type objects.', () => {
        let c = new Query();
        let typeKeys = Object.keys(Query.TYPE);
        for (let x = 0; x < typeKeys.length; x++) {
            c.out('test' + x, typeKeys[x].toUpperCase());
            expect(c.params.get('test' + x).type).toBe(Query.TYPE[typeKeys[x]]);
        }
    });
    test('returns the Query instance.', () => {
        let c = new Query();
        expect(c.out('abc', Query.TYPE.Money)).toBe(c);
        let typeKeys = Object.keys(Query.TYPE);
        for (let x = 0; x < typeKeys.length; x++) {
            expect(c.out('test' + x, Query.TYPE[typeKeys[x]], 123)).toBe(c);
        }
    });
    test('sets the proper output flag of false.', () => {
        expect(new Query().out('abc', Query.TYPE.Int).params.get('abc').output).toBe(true);
    });
    test('adds multiple parameters by object.', () => {
        let q = new Query();
        q.out({ a: 1, b: 2, c: 3 }, Query.TYPE.BigInt);
        expect(q.params.has('a')).toBeTruthy();
        expect(q.params.has('b')).toBeTruthy();
        expect(q.params.has('c')).toBeTruthy();
        expect(q.params.has('d')).toBeFalsy();
    });
    test('adds multiple parameters by Map.', () => {
        let q = new Query();
        let m = new Map();
        m.set('a', 1);
        m.set('b', 2);
        m.set('c', 3);
        q.out(m, Query.TYPE.BigInt);
        expect(q.params.has('a')).toBeTruthy();
        expect(q.params.has('b')).toBeTruthy();
        expect(q.params.has('c')).toBeTruthy();
        expect(q.params.has('d')).toBeFalsy();
    });
});

describe('#remove', () => {
    test('removes the specified parameter and returns true.', () => {
        let q = new Query();
        q.in('testA', 'int', 123);
        q.out('testB', 'bit');
        expect(q.remove('testA')).toBe(true);
        expect(q.params.has('testA')).toBe(false);
        expect(q.remove('testB')).toBe(true);
        expect(q.params.has('testA')).toBe(false);
        expect(q.params.size).toBe(0);
    });
    test('returns false when the parameter is not found.', () => {
        let q = new Query();
        q.in('testA', 'int', 123);
        q.out('testB', 'bit');
        expect(q.remove('doesntexist')).toBe(false);
        expect(q.params.size).toBe(2);
    });
    test('throws when the @name is falsey.', () => {
        let q = new Query();
        expect(() => q.remove()).toThrow(/name.+required/);
        expect(() => q.remove(null)).toThrow(/name.+required/);
        expect(() => q.remove(false)).toThrow(/name.+required/);
    });
    test('throws when the @name is not a string.', () => {
        let q = new Query();
        expect(() => q.remove(true)).toThrow(/name.+string/);
        expect(() => q.remove(34324)).toThrow(/name.+string/);
        expect(() => q.remove(new Date())).toThrow(/name.+string/);
    });
});

describe('#clear', () => {
    test('resets all properties.', () => {
        let q = new Query();
        q.sql('EXEC sp_123');
        q.in('test', 'BIT', 1);
        q.out('outTest', 'VARCHAR');
        q.clear();
        expect(q.statement).toBeNull();
        expect(q.mode).toBe(Query.MODE.QUERY);
        expect(q.params.size).toBe(0);
    });
});