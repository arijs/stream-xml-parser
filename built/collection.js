"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCollection = exports.arrayConcat = exports.arrayFrom = void 0;
function arrayFrom(val) {
    var slice = Array.prototype.slice;
    switch (true) {
        case val instanceof Array: return val;
        case void 0 == val: return [];
        case isCollection(val): return slice.call(val);
        default: return [val];
    }
}
exports.arrayFrom = arrayFrom;
function arrayConcat(val) {
    switch (true) {
        case val instanceof Array: return val;
        case void 0 == val: return [];
        default: return [val];
    }
}
exports.arrayConcat = arrayConcat;
function isCollection(obj) {
    var hop = Object.prototype.hasOwnProperty;
    var propEnum = Object.prototype.propertyIsEnumerable;
    var len, intLen;
    return obj &&
        'length' in obj &&
        !propEnum.call(obj, 'length') &&
        (len = obj.length,
            intLen = parseInt(len),
            intLen === len && intLen >= 0);
}
exports.isCollection = isCollection;
