"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var Infinity = 1 / 0;
var NaN = 0 / 0;
// @ts-ignore
var undefined = void 0;
// @ts-ignore
var Object = function _a(value) {
    var _newTarget = this && this instanceof _a ? this.constructor : void 0;
    if (_newTarget === undefined) {
        return new Object(value);
    }
    else {
        if (_newTarget !== Object) {
            return neutrino.c(__makeTemplateObject(["create_object(get_key(", ", \"prototype\"))"], ["create_object(get_key(", ", \"prototype\"))"]), _newTarget);
        }
        else if (value === null || value === undefined) {
            return neutrino.c(__makeTemplateObject(["create_object(get_key(", ", \"prototype\"))"], ["create_object(get_key(", ", \"prototype\"))"]), Object);
        }
        else if (typeof value === 'object' || typeof value === 'function') {
            return value;
        }
        else if (typeof value === 'boolean') {
            return new Boolean(value);
        }
        else if (typeof value === 'number') {
            return new Number(value);
        }
        else if (typeof value === 'string') {
            return new String(value);
        }
        else {
            throw new TypeError("Cannot convert ".concat(typeof value, " to an object"));
        }
    }
};
Object.prototype = {
    constructor: Object,
    hasOwnProperty: function (prop) {
        return prop in this && !(prop in neutrino.c(__makeTemplateObject(["this->prototype"], ["this->prototype"])));
    },
    isPrototypeOf: function (object) {
        return neutrino.c(__makeTemplateObject(["is_prototype_of(this, ", ")'"], ["is_prototype_of(this, ", ")'"]), object);
    },
    toLocaleString: function () {
        return this.toString();
    },
    toString: function () {
        return '[object Object]';
    },
    valueOf: function () {
        return this;
    },
};
Object.assign = function (target) {
    var values = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        values[_i - 1] = arguments[_i];
    }
    for (var i = 0; i < values.length; i++) {
        var value = values[i];
        for (var key in value) {
            target[key] = value[key];
        }
    }
};
var Function = {
    // @ts-ignore
    prototype: {
        prototype: {},
        apply: function (thisArg, args) {
            return neutrino.callFunction(neutrino.currentFunction, thisArg, args);
        },
        bind: function (thisArg) {
            var func = neutrino.currentFunction;
            return function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return neutrino.callFunction(func, thisArg, args);
            };
        },
        call: function (thisArg) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            return neutrino.callFunction(neutrino.currentFunction, thisArg, args);
        }
    },
};
Function.prototype.constructor = Function;
// @ts-ignore
var Boolean = function Boolean(value) {
    var _newTarget = this && this instanceof Boolean ? this.constructor : void 0;
    if (_newTarget) {
    }
};
Boolean.prototype = {
    constructor: Boolean,
};
