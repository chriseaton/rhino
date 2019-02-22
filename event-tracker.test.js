const EventTracker = require('./event-tracker.js');
const { EventEmitter } = require('events');
require('jest');

describe('#removeFrom', () => {
    test('removes all registered event listenerers.', () => {
        let et = new EventTracker();
        let ee = new EventEmitter();
        let l1 = () => { };
        let l2 = () => { };
        let l3 = () => { };
        ee.addListener('create', l1);
        ee.addListener('create', l1);
        ee.addListener('create', l2);
        et.register('create', l1);
        et.removeFrom(ee);
        expect(ee.listeners('create').length).toBe(1);
        expect(ee.listeners('create')[0]).toBe(l2);
    });
    test('removes registered event listeners under a specific @event.', () => {
        let et = new EventTracker();
        let ee = new EventEmitter();
        let l1 = () => { };
        let l2 = () => { };
        let l3 = () => { };
        ee.addListener('create', l1);
        ee.addListener('edit', l1);
        ee.addListener('edit', l2);
        ee.addListener('edit', l3);
        ee.addListener('destroy', l2);
        ee.addListener('destroy', l3);
        et.register('edit', l1, l3);
        et.removeFrom(ee, 'edit');
        expect(ee.listeners('create').length).toBe(1);
        expect(ee.listeners('edit').length).toBe(1);
        expect(ee.listeners('destroy').length).toBe(2);
    });
});

describe('#register', () => {
    test('throws on missing name parameter.', () => {
        let et = new EventTracker();
        expect(() => { et.register(null, () => { }); }).toThrow();
        expect(() => { et.register(null, null); }).toThrow();
        expect(() => { et.register('', () => { }); }).toThrow();
    });
    test('throws on missing listeners parameter.', () => {
        let et = new EventTracker();
        expect(() => { et.register('abc'); }).toThrow();
    });
    test('throws on non-function listeners parameter value.', () => {
        let et = new EventTracker();
        expect(() => { et.register('abc', null); }).toThrow();
        expect(() => { et.register('abc', () => { }, null); }).toThrow();
        expect(() => { et.register('abc', () => { }, null, () => { }); }).toThrow();
    });
    test('registers one.', () => {
        let et = new EventTracker();
        et.register('create', () => { });
        expect(et.listeners.length).toBe(1);
        expect(et.listeners[0]).toBeInstanceOf(Object);
        expect(et.listeners[0].event).toBe('create');
        expect(et.listeners[0].listener).toBeInstanceOf(Function);
    });
    test('registers multiple.', () => {
        let et = new EventTracker();
        let l1 = () => { };
        let l2 = () => { };
        let l3 = () => { };
        et.register('create', l1, l2, l3);
        expect(et.listeners.length).toBe(3);
        expect(et.listeners[0].event).toBe('create');
        expect(et.listeners[0].listener).toBe(l1);
        expect(et.listeners[1].event).toBe('create');
        expect(et.listeners[1].listener).toBe(l2);
        expect(et.listeners[2].event).toBe('create');
        expect(et.listeners[2].listener).toBe(l3);
    });
    test('skips duplicates.', () => {
        let et = new EventTracker();
        let l1 = () => { };
        let l2 = () => { };
        let l3 = () => { };
        et.register('create', l1, l2, l3);
        expect(et.listeners.length).toBe(3);
        et.register('create', l1);
        expect(et.listeners.length).toBe(3);
        et.register('create', l2, l3);
        expect(et.listeners.length).toBe(3);
        et.register('destroy', l1, l2);
        expect(et.listeners.length).toBe(5);
    });
});

describe('#unregister', () => {
    test('unregisters one.', () => {
        let et = new EventTracker();
        let l1 = () => { };
        et.register('create', l1);
        et.unregister('create', l1);
        expect(et.listeners.length).toBe(0);
    });
    test('unregisters multiple.', () => {
        let et = new EventTracker();
        let l1 = () => { };
        let l2 = () => { };
        let l3 = () => { };
        et.register('create', l1, l2, l3);
        et.unregister('create', l3, l1);
        expect(et.listeners.length).toBe(1);
        expect(et.listeners[0].event).toBe('create');
        expect(et.listeners[0].listener).toBe(l2);
    });
    test('unregisters listeners matching a @listener function.', () => {
        let et = new EventTracker();
        let target = () => { };
        et.register('create', () => { }, () => { });
        et.register('edit', () => { }, target, () => { });
        et.register('destroy', () => { }, () => { }, target);
        et.unregister(null, target);
        expect(et.listeners.length).toBe(6);
        for (let l of et.listeners) {
            expect(l.listener).not.toBe(target);
        }
    });
    test('unregisters all listeners under an event when @listeners is empty.', () => {
        let et = new EventTracker();
        et.register('create', () => { }, () => { });
        et.register('edit', () => { }, () => { });
        et.register('destroy', () => { }, () => { });
        et.unregister('edit');
        expect(et.listeners.length).toBe(4);
        for (let l of et.listeners) {
            expect(l.event).not.toBe('edit');
        }
    });
    test('unregisters all listeners.', () => {
        let et = new EventTracker();
        et.register('create', () => { }, () => { });
        et.register('edit', () => { }, () => { });
        et.register('destroy', () => { }, () => { });
        et.unregister();
        expect(et.listeners.length).toBe(0);
        et.register('edit', () => { }, () => { });
        et.register('destroy', () => { }, () => { });
        et.unregister(null);
        expect(et.listeners.length).toBe(0);
    });
});