"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var collection_1 = require("../collection");
exports.default = (function (apiDom) {
    var child = function (el, child) { return void el.appendChild(child); };
    var childCount = function (el) { return el.childNodes.length; };
    var childIndexGet = function (el, index) { return el.childNodes[index]; };
    var childSplice = function (el, index, remove, add) {
        //splice.apply(el.childNodes, [index, remove, ...(add || [])]);
        var ec = childCount(el);
        while (remove > 0 && ec > index) {
            el.removeChild(childIndexGet(el, index));
            remove--, ec--;
        }
        var i, c = add.length;
        var temp = []; // Live NodeList changes as we reassign nodes
        for (i = 0; i < c; i++) {
            temp.push(add[i]);
        }
        add = temp;
        for (i = 0; i < c; i++) {
            el.insertBefore(add[i], childIndexGet(el, index + i));
        }
    };
    var textNode = function (text) { return apiDom.createTextNode(text); };
    var isFragment = function (el) { return el.nodeType === apiDom.DOCUMENT_FRAGMENT_NODE; };
    var isComment = function (el) { return el.nodeType === apiDom.COMMENT_NODE; };
    var isChildren = function (ch) { return ch && ch.constructor === apiDom.childNodes.constructor; };
    // const splice = Array.prototype.splice;
    return {
        isText: function (el) { return el.nodeType === apiDom.TEXT_NODE; },
        isFragment: isFragment,
        isComment: isComment,
        isChildren: isChildren,
        initRoot: function () { return apiDom.createDocumentFragment(); },
        initName: function (name) { return apiDom.createElement(name); },
        initComment: function (text) {
            if (text === void 0) { text = ''; }
            return apiDom.createComment(text);
        },
        nameGet: function (el) { return el.nodeName; },
        textNode: textNode,
        textValueGet: function (el) { return el.nodeValue; },
        textValueSet: function (el, text) { return void (el.nodeValue = text); },
        attrsAdd: function (el, attr) { return el.setAttribute(attr.name, attr.value); },
        attrsEach: function (el, handler) {
            var list = el.attributes;
            if (!list)
                console.log('ElementDom attrs not found', el);
            var ctx = {
                _break: 1 << 0,
                _remove: 1 << 1
            };
            var count = list.length;
            for (var i = 0; i < count; i++) {
                var a = list[i];
                var ret = handler.call(ctx, a.name, a.value, a, i);
                if (ret & ctx._remove)
                    el.removeAttribute(a.name);
                if (ret & ctx._break)
                    break;
            }
        },
        childElement: child,
        childText: function (el, text) { return child(el, textNode(text)); },
        childCount: childCount,
        childIndexGet: function (el, index) { return el.childNodes[index]; },
        childSplice: childSplice,
        childrenGet: function (el) { return el.childNodes; },
        childrenSet: function (el, children) { return childSplice(el, 0, childCount(el), children); },
        toArray: function (el) {
            return !el ? [] :
                isFragment(el) ? collection_1.arrayFrom(el.childNodes) :
                    isChildren(el) ? collection_1.arrayFrom(el) :
                        collection_1.arrayConcat(el);
        }
    };
});
