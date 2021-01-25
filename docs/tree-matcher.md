# TreeMatcher

An regex-like engine for searching nodes in a html or xml document, together with a tool to modify or replace the nodes found. It's not 'regex' in the sense that all rules are strings, but because you can define the minimum and maximum number of times that each rule can match, and wether each rule is greedy or not (stop matching when the minimum or maximum amount of items have been found).

At first, this may look like a crappy 'css selector engine' without the actual 'selector' string syntax, and that's exactly what it is. By not having to define and parse a complex string syntax for selectors, you define your rules as POJO (plain old javascript objects), and the code is greatly simplified, lighter and maybe even faster.

Before we go deep in detail of the API, first here's a high-level API I call `PrinterTransform` that uses the `TreeMatcher` objects underneath.

```js
// Source:
// https://github.com/arijs/stream-xml-parser/blob/master/test/printertransform.js#L113-L189

// We'll talk about what are 'adapters' later.
var am = printerTransform.asyncMatcher(elAdapter);

// The rule below search for nodes:
// - which are <div>s
// - which have the attribute id="root"
// - which have _NO_ other attributes whatsoever
// - which are direct children of the <body> tag
//   - which is a direct child of the <html> tag
//   - which is the root node of the document
am.addRule({
  matcher: {
    name: 'div',
    attrs: [['id', 'root'], [null, null, '<0>']],
    path: ['html', 'body']
  },
  callback: function(opt) {
    // When this node is found, this callback function is called
    // and it can perform operations like replace, prepend, append,
    // insert another node before or after.
    // It can insert a tree of nodes or a html/xml string directly.
    // The 'children' property means to replace the entire content
    // of the node that was found with new content that is passed.
    return opt.callback(null, {
      noFormat: true,
      children: {text: '<div class="app--root">App</div>', noFormat: true}
    });
  }
});

// The rule below is very simple, it just searchs for the <head> tag
// inside of the <html> root node.
am.addRule({
  matcher: {
    name: 'head',
    path: ['html']
  },
  callback: function(opt) {
    // Here, we're appending a tree of nodes at the end of the <head> tag.
    return opt.callback(null, {
      append: {tree: buildCssLinks(elAdapter)}
    });
  }
});

// The rule below searchs for:
// - <script> tags
// - which have src="/js/index.js"
// - and no other attributes
// - and are children of <html><body>.
am.addRule({
  matcher: {
    name: 'script',
    attrs: [['src', '/js/index.js'], [null, null, '<0>']],
    path: ['html', 'body']
  },
  callback: function(opt) {
    // This callback will insert a html string after the <script> tag.
    return opt.callback(null, {
      after: {text: buildCompScripts(opt), noFormat: true}
    });
  }
});

// The rule below searchs for:
// - the <title> tag
// - which must have no attributes
// - inside of <html><head>.
am.addRule({
  matcher: {
    name: 'title',
    attrs: [[null, null, '<0>']],
    path: ['html', 'head']
  },
  callback: function(opt) {
    // here we replace the entire content as a html string.
    return opt.callback(null, {
      noFormat: true,
      children: {text: 'Replaced Title', noFormat: true}
    });
  }
});

// The rule below searchs for:
// - <meta> tags
// - which have name="description"
// - which have a 'content' attribute, regardless of the attribute value
// - and have no other attributes
// - inside of <html><head>.
am.addRule({
  matcher: {
    name: 'meta',
    attrs: [['name', 'description'], ['content', null], [null, null, '<0>']],
    path: ['html', 'head']
  },
  callback: function(opt) {
    // The 'full' property means to replace the entire tag with new content,
    // and not only its children.
    return opt.callback(null, {
      full: {tree: nodeContentAsTree('Replaced Description from PrinterTransform', opt)}
    });
  }
});

// Everything above was just configuration, the code below runs the actual transformation.
transformAsync(html.tree, elAdapter, am.transform, function(err, html) {
  console.log(err, html);
});
```

It works like this: you create `TreeMatcher` objects, and then you can add _Rules_ to it. We will show how to create the `TreeMatcher` objects later, but first we will talk about how to add _Rules_ to your objects.

## Rules

There's three types of _Rules_ you can add:

- **Name:**
  Searchs nodes by the tag name. Ex: `treeMatcher.name(search: String | RegExp | Function)`.

  - *String:*
    - `treeMatcher.name("div")` will find nodes where the name is `"div"` and nothing else.
    - `treeMatcher.name("*")` will match all nodes. Normally, if you want to match all nodes, you don't need to add a filter, you already have all the nodes. But the usefulness of this will be made clear in the [Repeaters](#Repeaters) section.

  - *RegExp:*
    - `treeMatcher.name(/^h[1-6]$/i)` will find heading nodes from `<h1>` to `<h6>`.

  - *Function:*
    - `treeMatcher.name(name => name === 'ol' || name === 'ul')` will find `<ol>` and `<ul>` nodes.
      Search using your custom function. Your function will receive the value from the current node being tested, and if it returns `true` or any non-empty and non-false value, the value will be considered as found.

- **Attributes:**
  Searchs nodes by the attributes it has. As attributes have _Names_ and _Values_, you can search by attributes names, or values, or both, or even neither. This is useful if you want to ensure to find only nodes which have some attributes, and nothing else - or of course, nodes without any attributes at all. The examples below will make this clearer.

  - *String:*
    - `treeMatcher.attr("disabled")` - find nodes which have the `disabled` attribute.
    - `treeMatcher.attr("maxlength=10")` - find nodes which have the `maxlength` attribute with the value set to `10`.
    - `treeMatcher.attr('data-val="json \"string\""')` - find nodes with `data-val` with the value `json "string"`.
      When the value is enclosed in double quotes, it is evaluated with `JSON.parse(value)`.

  - *Array:*
    - `treeMatcher.attr(["disabled"])` - when using an array, the first value will be matched against each attribute _name_.
    - `treeMatcher.attr([/^disabled$/])` - you can also use regular expressions.
    - `treeMatcher.attr([name => name === 'disabled'])` - and even functions!
    - `treeMatcher.attr(["maxlength", "10"])` - the second item in the array is matched against each attribute _value_.
    - `treeMatcher.attr([/^maxlength$/, v => +v >= 10 && +v <= 20])` - you can mix strings, regexes and functions.
    - `treeMatcher.attr([null, "json \"string\""])` - if the search item is `null` or `undefined`, it accepts anything.
      So this will search any attributes with the value `json "string"`.

  - *Object:*
    - `treeMatcher.attr({name:"disabled"})` - you can also use the object syntax.
    - `treeMatcher.attr({name:/^disabled$/})` - you can also use regular expressions.
    - `treeMatcher.attr({name: name => name === 'disabled'})` - and even functions!
    - `treeMatcher.attr({name: "maxlength", value: "10"})` - you can search the names and values of the attributes.
    - `treeMatcher.attr({name: /^maxlength$/, value: v => +v >= 10 && +v <= 20})` - you can mix strings, regexes and functions.
    - `treeMatcher.attr({value: "json \"string\""})` - if the _name_ or _value_ search are `null` or `undefined`, they accept anything.
      So this will search any attributes with the value `json "string"`.

- **Path:**
  Searchs nodes by their ancestors' chain from the root node of the document. The list of parent nodes from the current node's parent until the root.

  You can filter these nodes by _Name_ and _Attributes_. As the path of each node is a list of nodes, the search parameter must be an _Array_ of search terms. Inside this array you can use `String`, `Array` and `Object` values to filter each node in the list of parents:

  - *String:*
    The simplest way of search, the string values will be matched against each node _Name_ in the list of parents.
    - `treeMatcher.path(["html", "body"])` - match all nodes that are direct children of `<body>` which itself is a direct child of the root `<html>` tag.

  - *Array:*
    Can be used to filter nodes by the _Name_ and its _Attributes_: `[nameRule: String | Regexp | Function | null | undefined, attrsRules: Array<String | Array | Object>]`
    - ```js
      treeMatcher.path([
        ["html", ["lang"]],
        [/^body$/, [
          [/^class$/, /\bname-of-my-class\b/],
        ]],
        [], // <== matches _any_ node with _any_ name and _any_ attributes
        [name => name === "div" || name === "section", [
          {
            name: name => name === "data-val",
            value: value => value.indexOf("json \"string\"") !== -1,
          },
        ]],
      ]);
      ```

  - *Object:*
    If you prefer, you can use the object syntax:
    - ```js
      treeMatcher.path([
        {name: "html", attrs: ["lang"]},
        {name: /^body$/, attrs: [
          [/^class$/, /\bname-of-my-class\b/],
        ]},
        {}, // <== matches _any_ node with _any_ name and _any_ attributes
        {name: name => name === "div" || name === "section", attrs: [
          {
            name: name => name === "data-val",
            value: value => value.indexOf("json \"string\"") !== -1,
          },
        ]},
      ]);
      ```

  But what if, for example, you want to search some tags that are _descendant_ of some element (ie, not only direct children but child of a child and so on) down any number of levels, and even with _limits_ (minimum and maximum number of levels down)?

  For that you can use _Repeaters_, just like you have with regular expressions. See the details below.

## Repeaters

In regular expressions, you match a caracter like this: `/a/`.

If you want to find a character one or more times, you use this: `/a+/`.

To find zero or any number of repeated characters, you use this: `/a*/`.

You can also find zero or one characters, making it optional: `/a?/`.

And finally you can specify custom limits for the minimum and maximum values: `/a{2,6}/`.

You can repeat an exact number of times: `/a{3}/`.

To find three times or more, you can do this: `/a{3,}/`.

By default, repeaters are greedy - if the next element match the current search and the maximum limit was not yet reached, the item is 'taken' by the current search and the next search will start from the following element.

But just like regular expressions, you can also 'invert' this logic and make the search _not greedy_. This will make the search attempt to match as few items as possible (at least the specified minimum times) and give the opportunity for the next search to match the next element, even if it also matches the current search and the maximum limit was not yet reached.

To make a search _not greedy_, you add a question mark character at the end: `/a+?/`, `/a*?/`, `/a??/`, `/a{2,6}?/`, `/a{3,}?/`.

The idea is the same, you can have repeaters in the _Attributes_ and _Path_ rules.

There are two syntaxes for repeaters: the _short_ version `(String)` and the _expanded_ version `(Object)`.

### Short repeaters (string)

They have almost the same syntax from regular expressions. Examples:

- **Attributes:**
  - `treeMatcher.attr("attr-name <+>")` - find nodes with one or more `attr-name` attributes, independently of their values.
  - `treeMatcher.attr("attr-name=attr value <*>")` - find nodes with zero or more `attr-name="attr value"` attributes.
    This is equivalent to not setting the rule at all, because the rule will match anyway.
  - `treeMatcher.attr('attr-name="json \"string\"" <?>')` - this will find nodes with zero or one `attr-name='json "string"'` attributes.
    It's very likely to match all nodes, but it will **not** match if the attribute is repeated two or more times. But what kind of sane person does that?
  - `treeMatcher.attr("attr-name <2,6>")` - will match if the node has at least two and at most six `attr-name` attributes, independently of their values.
  - `treeMatcher.attr("attr-name=attr value <3>")` - will match if the node has exactly three `attr-name="attr value"` attributes.
  - `treeMatcher.attr('attr-name="json \"string\"" <3,>')` - will find nodes with three or more `attr-name='json "string"'` attributes.
  - `treeMatcher.attr("attr-name <0>")` - matches exactly zero `attr-name` attributes. This effectively negates the search, and the node is considered _found_ if it _does not_ have the attribute.
  - `treeMatcher.attr([null, null, "<0>"])` - this is where it gets interesting. This matches any attribute, but only accepts zero matches! You can use this to search for nodes with _no attributes at all_.
    In fact, it is even more powerful than that. Combined with other attribute rules, you can search for nodes which have only the attributes in your search, _and without any other attributes_.

- **Path:**
  Assume each value below is inside of the path search array: `treeMatcher.path([ ...items ])`:
  - `"html <1>"` - Match exactly one `<html>` tag at the root of the document, because it is the first item in the array.
  - `["body <?>", ["attr-name=attr value"]]` - Allow one `body` tag. It may not be present, but if it is, it must have the `attr-name="attr value"` attribute.
  - `"div <+>"` - There must be one or more `<div>`s in the path.
  - `"* <*>"` - Anything goes in here, including nothing at all.
  - `{name: "* <2,6>", attrs: [{name:"class", value: /\bname-of-class\b/}]}` - Accepts from two to six nodes with any name, but they must have the class `name-of-class`.
  - `"* <*>"` - Again, accept anything, including nothing at all.

### Expanded repeaters (object)

The object syntax for the repeat options are as follows:

```js
opt = {
  repeatMin: Number, 
  repeatMax: Number,
  repeatGreedy: Boolean,
}
```

The default values are actually different wether they're for _Attribute_ or _Path_ rules:

| Default        | Attribute | Path  |
| -------------- | --------- | ----- |
| `repeatMin`    | 1         | 1     |
| `repeatMax`    | Infinity  | 1     |
| `repeatGreedy` | false     | false |

- **Attributes:**
  - `treeMatcher.attr(attrRule: String | Array | Object, opt: Object)` - you can send the repeater options in the second argument to the `attr()` function.

- **Path:**
  To pass the repeater options object, you must use the object format for each rule inside the path array.
  Assume each value below is inside of the path search array: `treeMatcher.path([ ...items ])`:
  - `{name: "html", nameOpt: {repeatMin: 1, repeatMax: 1}}` - yes the 'name' (pun not intended) of the property could be better.
  - `{name: "body", attrs: ["attr-name=attr value"], nameOpt: {repeatMin: 0, repeatMax: 1}}` - Allow one `body` tag. It may not be present, but if it is, it must have the `attr-name="attr value"` attribute.
  - `{name: "div", nameOpt: {repeatMin: 1, repeatMax: Infinity}}` - There must be one or more `<div>`s in the path.
  - `{nameOpt: {repeatMin: 0, repeatMax: Infinity}}` - Anything goes in here, including nothing at all.
  - `{name: "*", attrs: [{name:"class", value: /\bname-of-class\b/}], nameOpt: {repeatMin: 2, repeatMax: 6}}` - Accepts from two to six nodes with any name, but they must have the class `name-of-class`.
  - `{nameOpt: {repeatMin: 0, repeatMax: Infinity}}` - Again, accept anything, including nothing at all.

## Sources and other examples

Package: https://www.npmjs.com/package/@arijs/stream-xml-parser

Matcher engine source: https://github.com/arijs/stream-xml-parser/blob/master/src/treematcher.mjs

Nodes Transformer source: https://github.com/arijs/stream-xml-parser/blob/master/src/printertransform.mjs

Example Test case: https://github.com/arijs/stream-xml-parser/blob/master/test/printertransform.js#L113-L189

A more practical example: https://github.com/arijs/vue-prerender/blob/master/examples/full/prerender.mjs#L258-L348

## FAQ

Please submit your questions [in the discussions section](https://github.com/arijs/stream-xml-parser/discussions) and it may get featured here.
