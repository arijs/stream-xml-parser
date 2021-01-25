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
exports.default = (function (_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.keyName, keyName = _c === void 0 ? 'name' : _c, _d = _b.keyAttrs, keyAttrs = _d === void 0 ? 'attrs' : _d, _e = _b.keyChildren, keyChildren = _e === void 0 ? 'children' : _e, _f = _b.keyText, keyText = _f === void 0 ? 'text' : _f, _g = _b.textName, textName = _g === void 0 ? '#text' : _g, _h = _b.rootName, rootName = _h === void 0 ? '#document-fragment' : _h, _j = _b.commentName, commentName = _j === void 0 ? '#comment' : _j, _k = _b.declarationName, declarationName = _k === void 0 ? '#declaration' : _k, _l = _b.instructionName, instructionName = _l === void 0 ? '#instruction' : _l;
    var initName = function (name) {
        var _a;
        return (_a = {},
            _a[keyName] = name,
            _a[keyAttrs] = [],
            _a[keyChildren] = [],
            _a[keyText] = null,
            _a);
    };
    var child = function (el, child) { return void el[keyChildren].push(child); };
    var textNode = function (text) {
        var _a;
        return (_a = {}, _a[keyName] = textName, _a[keyText] = text, _a);
    };
    return {
        isText: function (el) { return textName === el[keyName]; },
        isFragment: function (el) { return el[keyName] === rootName; },
        isComment: function (el) { return el[keyName] === commentName; },
        isDeclaration: function (el) { return el[keyName] === declarationName; },
        isInstruction: function (el) { return el[keyName] === instructionName; },
        isChildren: function (ch) { return ch instanceof Array; },
        initRoot: function () { return initName(rootName); },
        initName: initName,
        initComment: function (text, el) {
            if (text === void 0) { text = ''; }
            return (el = initName(commentName), el[keyText] = text, el);
        },
        initDeclaration: function (text, el) {
            if (text === void 0) { text = ''; }
            return (el = initName(declarationName), el[keyText] = text, el);
        },
        initInstruction: function (text, el) {
            if (text === void 0) { text = ''; }
            return (el = initName(instructionName), el[keyText] = text, el);
        },
        nameGet: function (el) { return el[keyName]; },
        textNode: textNode,
        textValueGet: function (el) { return el[keyText]; },
        textValueSet: function (el, text) { return el[keyText] = text; },
        attrsAdd: function (el, attr) { return void el[keyAttrs].push(attr); },
        attrsEach: function (el, handler) {
            var list = el[keyAttrs];
            if (!list)
                console.log('ElementDefault attrs not found', el, keyAttrs);
            var count = list && list.length || 0;
            var ctx = {
                _break: 1 << 0,
                _remove: 1 << 1
            };
            for (var i = 0; i < count; i++) {
                var a = list[i];
                var ret = handler.call(ctx, a.name, a.value, a, i);
                if (ret & ctx._remove)
                    list.splice(i, 1), i--, count--;
                if (ret & ctx._break)
                    break;
            }
        },
        childElement: child,
        childText: function (el, text) { return child(el, textNode(text)); },
        childCount: function (el) { return el[keyChildren].length; },
        childIndexGet: function (el, index) { return el[keyChildren][index]; },
        childSplice: function (el, index, remove, add) {
            var _a;
            return (_a = el[keyChildren]).splice.apply(_a, __spreadArrays([index, remove], (add || [])));
        },
        childrenGet: function (el) { return el[keyChildren]; },
        childrenSet: function (el, children) { return el[keyChildren] = children; },
        toArray: collection_1.arrayConcat,
    };
});
