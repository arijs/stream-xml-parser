"use strict";
// import {arrayFrom, arrayConcat} from './collection';
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adapterPluginConvertElement = exports.pluginConvertElement = exports.pluginAttr = exports.pluginChildren = exports.pluginListChildren = exports.treeRender = exports.treeRenderPlugin = exports.listToNode = void 0;
function listToNode(list, adapter) {
    var node = adapter.initRoot();
    adapter.childrenSet(node, list);
    return node;
}
exports.listToNode = listToNode;
function treeRenderPlugin(sourceTree, sourceAdapter, ctx, plugin, targetAdapter, createTree, targetTree) {
    if (!ctx)
        ctx = {};
    if (!targetAdapter)
        targetAdapter = sourceAdapter;
    var sourceArray = sourceAdapter.isChildren(sourceTree);
    if (sourceArray)
        sourceTree = listToNode(sourceTree, sourceAdapter);
    if (createTree)
        targetTree = targetAdapter.initRoot();
    else if (!targetTree)
        targetTree = sourceTree;
    else if (targetAdapter.isChildren(targetTree)) {
        targetTree = listToNode(targetTree, targetAdapter);
    }
    var tc = sourceAdapter.childCount(sourceTree);
    var nodeInput, nodeOutput, arrayOutput, j, jOffset = 0;
    var parentBreadcrumb = ctx.getBreadcrumb;
    var getBreadcrumbLast = function () {
        return {
            // node: tree[j],
            index: j,
            indexOffset: jOffset,
            indexTarget: j + jOffset,
            node: sourceAdapter.childIndexGet(sourceTree, j),
            parent: sourceTree,
            parentTarget: targetTree,
        };
    };
    var getBreadcrumb = function () {
        var par = parentBreadcrumb && parentBreadcrumb();
        var last = getBreadcrumbLast();
        return par ? __spreadArrays(par, [last]) : [last];
    };
    for (j = 0; j < tc; j++) {
        nodeInput = sourceAdapter.childIndexGet(sourceTree, j);
        ctx.getBreadcrumbLast = getBreadcrumbLast;
        ctx.getBreadcrumb = getBreadcrumb;
        nodeOutput = plugin(nodeInput, sourceAdapter, ctx, targetAdapter, createTree, targetTree);
        arrayOutput = targetAdapter.toArray(nodeOutput);
        var nc = arrayOutput.length - 1;
        targetAdapter.childSplice(targetTree, j + jOffset, 1, arrayOutput);
        if (targetTree === sourceTree) {
            j += nc, tc += nc;
        }
        else {
            jOffset += nc;
        }
    }
    ctx.getBreadcrumb = parentBreadcrumb;
    if (sourceArray) {
        targetTree = targetAdapter.childrenGet(targetTree);
    }
    return targetTree;
}
exports.treeRenderPlugin = treeRenderPlugin;
function treeRender(sourceTree, sourceAdapter, ctx, plugins) {
    var _a;
    var pc = plugins.length, i;
    for (i = 0; i < pc; i++) {
        var plugin = plugins[i];
        var targetAdapter, createTree, targetTree;
        if (!(plugin instanceof Function)) {
            (_a = plugin, plugin = _a.plugin, targetAdapter = _a.targetAdapter, createTree = _a.createTree, targetTree = _a.targetTree);
        }
        sourceTree = treeRenderPlugin(sourceTree, sourceAdapter, ctx, plugin, targetAdapter, createTree, targetTree);
        if (targetAdapter)
            sourceAdapter = targetAdapter;
    }
    return sourceTree;
}
exports.treeRender = treeRender;
function pluginListChildren(node, adapter, ctx, plugins) {
    if (!adapter.isText(node)) {
        var tree = adapter.childrenGet(node);
        if (tree)
            adapter.childrenSet(node, treeRender(tree, adapter, ctx, plugins));
    }
    return node;
}
exports.pluginListChildren = pluginListChildren;
function pluginChildren(node, adapter, ctx, plugin, createTree) {
    if (!adapter.isText(node)) {
        var tree = adapter.childrenGet(node);
        if (tree)
            adapter.childrenSet(node, treeRenderPlugin(tree, adapter, ctx, plugin, targetAdapter, createTree));
    }
    return node;
}
exports.pluginChildren = pluginChildren;
function pluginAttr(node, adapter, ctx, attrHandler, resultNode) {
    adapter.attrsEach(node, function (name, value, attr, index) {
        attrHandler(name, value, node, ctx, attr, index);
    });
    return resultNode ? resultNode(node, ctx) : node;
}
exports.pluginAttr = pluginAttr;
// plugin(nodeInput, sourceAdapter, ctx, targetAdapter, createTree);
function pluginConvertElement(node, adapter, ctx, targetAdapter, createTree) {
    var nodeTo, children;
    if (adapter.isText(node)) {
        nodeTo = targetAdapter.textNode(adapter.textValueGet(node));
    }
    else {
        nodeTo = targetAdapter.initName(adapter.nameGet(node));
        adapter.attrsEach(node, function (name, value, attr) {
            if (!attr)
                attr = { name: name, value: value };
            targetAdapter.attrsAdd(nodeTo, attr);
        });
        // children = targetAdapter.childrenGet(nodeTo);
        treeRenderPlugin(node, adapter, ctx, pluginConvertElement, targetAdapter, createTree, nodeTo);
        // treeRenderPlugin(children, adapter, ctx, pluginConvertElement, targetAdapter, createTree);
        // treeRenderPlugin(sourceTree, sourceAdapter, ctx, plugin, targetAdapter, createTree) {
    }
    return nodeTo;
}
exports.pluginConvertElement = pluginConvertElement;
function adapterPluginConvertElement(targetAdapter) {
    return plugin;
    function plugin(nodeInput, sourceAdapter, ctx, _, createTree) {
        return pluginConvertElement(nodeInput, sourceAdapter, ctx, targetAdapter, createTree);
    }
}
exports.adapterPluginConvertElement = adapterPluginConvertElement;
