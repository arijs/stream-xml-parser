"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var collection_1 = require("../collection");
var initName = function (name) { return ({
    _name: name,
    _class: null,
    _id: null,
    sel: name,
    data: {},
    text: void 0,
    children: []
}); };
var textNode = function (text) { return ({ text: text }); };
var child = function (el, child) { return void el.children.push(child); };
var attrIdSel = function (attr, el) {
    if (attr.name === 'id') {
        el._id = attr.value;
        attrUpdateSel(el);
        return true;
    }
};
var attrClassSel = function (attr, el) {
    if (attr.name === 'class') {
        el._class = attr.value;
        attrUpdateSel(el);
        return true;
    }
};
var attrUpdateSel = function (el) {
    var c = el._class;
    var i = el._id;
    el.sel = el._name +
        (i ? '#' + i : '') +
        (c ? '.' + c.replace(/\s+/g, '.') : '');
};
var attrObject = function (attr, el, key) {
    var ea = el.data[key];
    if (!ea)
        el.data[key] = ea = {};
    ea[attr.name] = attr.value;
    return true;
};
var attrHandlerDefault = function (el, attr) {
    return attrIdSel(attr, el)
        || attrClassSel(attr, el)
        || attrObject(attr, el, 'attrs');
};
var attrFn = {
    attrIdSel: attrIdSel,
    attrClassSel: attrClassSel,
    attrUpdateSel: attrUpdateSel,
    attrObject: attrObject,
    attrHandlerDefault: attrHandlerDefault
};
var refFragment = {};
var nameComment = '!';
// I don't like the default arg below but TS complains if I try "= {}"
exports.default = (function (_a) {
    var attrHandler = (_a === void 0 ? { attrHandler: undefined } : _a).attrHandler;
    attrHandler = (attrHandler || attrHandlerDefault).bind(attrFn);
    return {
        isText: function (el) { return !el.sel && 'string' === typeof el.text; },
        isFragment: function (el) { return el._name === refFragment; },
        isComment: function (el) { return el._name === nameComment; },
        isChildren: function (ch) { return ch instanceof Array; },
        initRoot: function () { return initName(refFragment); },
        initName: initName,
        initComment: function (text) {
            if (text === void 0) { text = ''; }
            var el = initName(nameComment);
            el.text = text;
            return el;
        },
        nameGet: function (el) { return el._name; },
        textNode: textNode,
        textValueGet: function (el) { return el.text; },
        textValueSet: function (el, text) { return void (el.text = text); },
        attrsAdd: attrHandler,
        attrsEach: function (el, handler) {
            if (el && !el.data)
                console.log('ElementSnabbdom data not found', el);
            var map = el.data.attrs;
            var hop = Object.prototype.hasOwnProperty;
            if (!map)
                return;
            var ctx = {
                _break: 1 << 0,
                _remove: 1 << 1
            };
            var keys = [], k;
            for (k in map)
                if (hop.call(map, k))
                    keys.push(k);
            for (var i = 0, count = keys.length; i < count; i++) {
                k = keys[i];
                var ret = handler.call(ctx, k, map[k], null, i);
                if (ret & ctx._remove)
                    delete map[k];
                if (ret & ctx._break)
                    break;
            }
        },
        childElement: child,
        childText: function (el, text) { return child(el, textNode(text)); },
        childCount: function (el) { return el.children.length; },
        childIndexGet: function (el, index) { return el.children[index]; },
        childSplice: function (el, index, remove, add) {
            var _a;
            return (_a = el.children).splice.apply(_a, __spreadArrays([index, remove], (add || [])));
        },
        childrenGet: function (el) { return el.children; },
        childrenSet: function (el, children) { return el.children = children; },
        toArray: collection_1.arrayConcat,
    };
});
