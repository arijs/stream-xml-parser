"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var xmlparser_1 = require("./xmlparser");
var treebuilder_1 = require("./treebuilder");
var default_1 = require("./element/default");
var htmlvoidtagmap_1 = require("./htmlvoidtagmap");
function getParser(elAdapter, tagVoidMap) {
    elAdapter = elAdapter || default_1.default();
    tagVoidMap = tagVoidMap || htmlvoidtagmap_1.default;
    var tb = new treebuilder_1.default({
        element: elAdapter,
        tagVoidMap: tagVoidMap
    });
    var xp = new xmlparser_1.default(tb.parserEvent.bind(tb));
    return {
        write: xp.write.bind(xp),
        end: xp.end.bind(xp),
        getResult: function (_a) {
            var asNode = (_a === void 0 ? { asNode: undefined } : _a).asNode;
            var error = tb.errors;
            var tree = tb.root && tb.root.tag;
            tree = asNode ? tree : elAdapter.childrenGet(tree);
            if (error instanceof Array && 0 === error.length)
                error = null;
            return {
                error: error,
                tree: tree,
                elAdapter: elAdapter,
                builder: tb,
                parser: xp
            };
        },
        elAdapter: elAdapter
    };
}
exports.default = getParser;
