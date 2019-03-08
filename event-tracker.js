const { EventEmitter } = require('events');

/**
 * @typedef EventTracker.RegisteredEventListener
 * @property {String|Symbol} event
 * @property {Function} listener
 */

/**
 * Provides tooling to easily track event listeners and remove them from `EventEmitter` instances without affecting 
 * listeners added from other operations.
 */
class EventTracker {

    /**
     * Creates a new `EventTracker` instance.
     */
    constructor() {

        /**
         * Array containing all of the registered event listeners in this tracker instance.
         * @type {Array.<EventTracker.RegisteredEventListener>}
         */
        this.listeners = [];
    }

    /**
     * Removes all registered matching event listeners from the specified emitter.
     * @param {EventEmitter} emitter - The instance implementing the EventEmitter "removeListener" function.
     * @param {String|symbol} [event] - Optional event to target for removal. Only listeners under the event will be
     * removed.
     * @param {Boolean} [unregister] - Removes the registered listeners after they have been removed from the emitter.
     * Works with the `event` parameter, if specified. If a listerner is not found, on the emitter, it is not
     * unregistered.
     */
    removeFrom(emitter, event, unregister) {
        if (emitter && this.listeners && this.listeners.length) {
            let events = (event ? [event] : emitter.eventNames());
            for (let e of events) {
                let elisteners = emitter.listeners(e);
                for (let x = this.listeners.length - 1; x >= 0; x--) {
                    if (this.listeners[x].event === e) {
                        let found = false;
                        for (let el of elisteners) {
                            if (this.listeners[x].listener == el) {
                                emitter.removeListener(e, el);
                                found = true;
                            }
                        }
                        if (found && unregister) {
                            this.listeners.splice(x, 1);
                        }
                    }
                }
            }
        }
    }

    /**
     * Registers one or more event listeners.
     * @param {String|Symbol} event - The event name or symbol.
     * @param {...Function} listeners - The listener functions.
     */
    register(event, ...listeners) {
        if (!event) {
            throw new Error('The "event" parameter argument is required.');
        }
        if (!listeners || !listeners.length) {
            throw new Error('The "listeners" parameter argument is required.');
        }
        for (let l of listeners) {
            if (typeof l !== 'function') {
                throw new Error('The "listeners" cannot register a non-function value as a listener.');
            }
            if (this.listeners.some(v => v.event === event && v.listener === l) === false) {
                this.listeners.push({ event: event, listener: l });
            }
        }
    }

    /**
     * Registers one or more event listeners in the tracker and on the specified target objects.
     * @param {EventEmitter|Array.<EventEmitter>} emitters - An `EventEmitter` instance or array of instances to 
     * add the specified event listeners on using the `addListener` function call.
     * @param {String|Symbol} event - The event name or symbol.
     * @param {...Function} listeners - The listener functions.
     */
    registerOn(emitters, event, ...listeners) {
        if (!emitters) {
            throw new Error('The "emitters" parameter argument is required.');
        }
        this.register(event, ...listeners);
        for (let l of listeners) {
            if (Array.isArray(emitters)) {
                for (let e of emitters) {
                    e.addListener(event, l);
                }
            } else {
                emitters.addListener(event, l);
            }
        }
    }

    /**
     * Un-registers one or more event listeners by matching the event and/or listener function(s). Either, both, or 
     * none of the parameters may be specified. If both event and listerner(s) are not specified, all listeners are
     * unregistered.
     * @param {String|Symbol} [event] - The event name or symbol to match for unregistering listeners.
     * @param {...Function} [listeners] - The listener functions to unregister. If none are specified, all listeners
     * under the event are unregistered.
     */
    unregister(event, ...listeners) {
        if (!event && (!listeners || !listeners.length)) {
            this.listeners.length = 0;
        } else {
            for (let x = this.listeners.length - 1; x >= 0; x--) {
                if (!event || this.listeners[x].event === event) {
                    if (listeners && listeners.length) {
                        for (let l of listeners) {
                            if (this.listeners[x].listener === l) {
                                this.listeners.splice(x, 1);
                                break;
                            }
                        }
                    } else {
                        this.listeners.splice(x, 1);
                    }
                }
            }
        }
    }
}

module.exports = EventTracker;