const Result = require('./result.js');
require('jest');

describe('.flatten', () => {
    test('returns null when no Result instances are found in arguments.', () => {
        expect(Result.flatten()).toBeNull();
        expect(Result.flatten([])).toBeNull();
        expect(Result.flatten([], [], null)).toBeNull();
    });
    test('returns a single Result if only one is found in arguments', () => {
        expect(Result.flatten(new Result())).toBeInstanceOf(Result);
        expect(Result.flatten(null, new Result())).toBeInstanceOf(Result);
        expect(Result.flatten([new Result()])).toBeInstanceOf(Result);
        expect(Result.flatten([], [new Result()])).toBeInstanceOf(Result);
        expect(Result.flatten(new Result(), null)).toBeInstanceOf(Result);
        expect(Result.flatten([new Result(), null])).toBeInstanceOf(Result);
        expect(Result.flatten([new Result()], [])).toBeInstanceOf(Result);
    });
    test('returns a only results found in arguments.', () => {
        let data = [
            new Result(),
            new Result(),
            new Result(),
        ];
        expect(Result.flatten(data).length).toBe(3);
        let output = Result.flatten(null, data[1], [data[2]]);
        expect(output.length).toBe(2);
        expect(output[0]).toBe(data[1]);
        expect(output[1]).toBe(data[2]);
        output = Result.flatten(null, data[0], [data[2]], null, [null, null, data[1]]);
        expect(output.length).toBe(3);
        expect(output[0]).toBe(data[0]);
        expect(output[1]).toBe(data[2]);
        expect(output[2]).toBe(data[1]);
    });
});