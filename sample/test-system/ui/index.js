
//import $ from "https://code.jquery.com/jquery-3.3.1.min.js";

const output = $(`#output`);
const input = $(`#input`);

function el(str) {
  const digest = /^<?([-_a-zA-Z]+)((?:\.[-_a-zA-Z0-9]+)*)(#[-_a-zA-Z0-9]*)?>?$/.exec(str);

  if (!digest) throw new TypeError(`invalid HTML element gist: ${str}`);

  let [dontCare, tag, classes, id] = digest;
  const attr = {};
  if (classes) {
    let them = classes.split('.');
    ([dontCare, ...them] = them);
    attr["class"] = them.join(' ');
  }
  if (id) {
    ([dontCare, id] = /^#(.*)$/.exec(id));
    attr.id = id;
  }
  return $(`<${tag}>`, attr);
}

function putJson(json) {
  if (json instanceof Array) {
    const ol = el(`<ol.array>`);
    for (let item of json) {
      el(`<li.item>`).append(putJson(item)).appendTo(ol);
    }
    return ol;
  } else if (typeof json === `object`) {
    const ul = el(`<ul.object>`);
    for (key of Object.keys(json)) {
      const li = el(`<li.property>`).appendTo(ul);
      el(`<span.key>`).text(`${key}: `).appendTo(li);
      li.append(putJson(json[key]));
    }
    return ul;
  } else if (typeof json === `string` && json.includes('<')) {
    return el(`<span.value>`).html(json);
  } else if (typeof json === `function`) {
    if (json.isHelp) {
      let it = el(`<p.help>`).text(json());
      if (json.details) {
        let deets = $(`<div>`).appendTo(it);
        json.details.forEach((det) => {
          $(`<a>`).appendTo(deets).text(det).attr({href: '#'}).click(function (ev) {
            ev.preventDefault();
            $(this).closest(`p.help`).after(putJson(json[det]));
          }).after($(`<span>`).text(` | `));
        });
      }
      return it;
    } else if (json.help) {
      return putJson(json.help);
    }
    return el(`<span.code>`).text(`${json.name || `function `}()`);
  } else {
    return el(`<span.value>`).text(JSON.stringify(json));
  }
}

function repl(code) {
  const div = el(`<p.command>`);
  output.children().first().before(div);
  const codeDiv = el(`<div.user>`).append($(`<kbd>`).text(code)).appendTo(div);

  // tried to not eval with new Function, but that's eval anyway, just more complicated.
  let fn;
  try {
    fn = () => eval(code);
  } catch (e) {
    codeDiv.addClass(`error`);
    div.addClass(`failed`);
    el(`<div.client.error-message>`)
      .append( el(`<div.client>`).text(`Failed to execute:`) )
      .append( el(`<div.js.error>`).text(''+e) )
    .appendTo(div);
    return false;
  }

  let result;
  try {
    result = fn();
  } catch (e) {
    div.addClass(`fail`);
    codeDiv.addClass(`error`);
    el(`<div.client.error-message>`)
      .append( el(`<div.client>`).text(`While executing:`) )
      .append( el(`<div.js.error>`).text(''+e) )
    .appendTo(div);
    return false;
  }

  if (!result || !result.then) {
    el(`<div.client.response>`).append(putJson(result)).appendTo(div);
    return false;
  }

  const waiting = el(`<div.client.waiting>`).text(`Waiting for response...`).appendTo(div);
  div.addClass(`pending`);

  result.then((response) => {
    div.removeClass(`pending`).addClass(`complete`);

    if (typeof response === `string`) {
      response = JSON.parse(response);
    }

    const out = el(`<div.server.response>`).replaceAll(waiting);
    let tail;

    if (response && response.msg) {
      const msg = response.msg;
      delete response.msg;

      tail = el(`<div.server.status-message.head>`).text(msg);
      if (msg === `ok`) {
        tail.addClass(`ok`);
        div.addClass(`success`);
      } else {
        tail.addClass(`error`);
        div.addClass(`fail`);
      }
    }

    out.append(putJson(response));
    if (tail) out.append(tail);

  }, (e) => {
    div.removeClass(`pending`).addClass(`fail`);

    el(`<div.server.response.error>`).text(`Server error: ${e}`).replaceAll(waiting);
  });

  return false;
}

function deepAssign(dest, src, ...more) {
  for (let p of Object.keys(src)) {
    let v;
    if (typeof src[p] == `object`) {
      v = deepAssign(dest[p] || {}, src[p]);
    } else {
      v = src[p];
    }
    dest[p] = v;
  }

  if (more.length) {
    let [u, ...rest] = more;
    return deepAssign(dest, u, ...rest);
  } else {
    return dest;
  }
}

function h(val, details) {
  function help () {
    return val;
  }
  delete help.name;
  if (details) {
    deepAssign(help, details);
    help.details = Object.keys(details);
  }

  help.isHelp = true;
  return help;
}

const help = {
  singular: h(`singular({repo, tag}).  Defines a tag to be exclusive.  A LinkRepo with
    a singular tag will remove any previous links of the same tag from an object before
    adding a link to a different object.  The effect is that an object only ever has one
    link with that tag.`,
  {
    repo: h(`repo: Name.  The LinkRepo that will enforce the singular rule.`),
    tag: h(`tag: string.  The tag that any object can have only one of.`)
  }),
  predicate: h(`predicate({trigger, query, dependent}).  Defines a predicate rule, e.g.
    For A where A worksFor B => All C where B bossOf C => C peerOf A.  The trigger repo will maintain
    that ternary relationship when the trigger tag is used to link/unlink objects automatically.  The query and
    dependent repos will not share that rule automatically if they are different unless told to
    do so separately.  The same is true of the query tag and dependent tag.
    * this is a new experimental rule type.`,
  {
    trigger: h(`trigger: {repo, tag}.  The trigger tag in the example was "worksFor".`, {
      repo: h(`trigger.repo: Name.  This is the LinkRepo object that will listen on the
        trigger tag and maintain the rule when it is used.`),
      tag: h(`trigger.tag: string.  This is the tag that triggers the operation.`)
    }),
    query: h(`query: {repo, tag}.  The query tag in the example was "bossOf".`, {
      repo: h(`query.repo: Name.  This is the repo that has the query tag that will find
        the objects to have the dependent tag applied.  Much less important on client-side.`),
      tag: h(`query.tag: string.  When the rule is applied, the set of objects that will
        be linked/unlinked to the subject of the trigger link are those who are the
        subjects of a link with this tag, from the target of the trigger tag.  Sorry about this.`)
    }),
    dependent: h(`dependent: {repo, tag}.  The dependent tag in the example was "peerOf"`, {
      repo: h(`dependent.repo: Name.  This repo has the dependent tag and deals with
        objects that can link with it.`),
      tag: h(`dependent.tag: string.  This is the tag that will link objects of the
        query tag back to the subject of the trigger tag.`)
    })
  }),
  reciprocal: h(`reciprocal({local, foreign?}).  Defines a reciprocal rule, e.g.
    All A worksFor B => B bossOf A.  The local LinkRepo will maintain this relationship when the local
    tag is used to link/unlink objects automatically.
    Only the local LinkRepo knows this rule; the foreign repo must be told separately if symmetry is desired.`,
  {
    local: h(`local: {repo, tag}.  Specifies the repo that will know the rule and
      the tag that will apply it.`,
    {
      repo: h(`local.repo: Name.  The LinkRepo that will know the rule.`),
      tag: h(`local.tag: string.  Linking an object with this tag through the local repo triggers the reciprocal to be applied.`)
    }),
    foreign: h(`(optional) foreign: {repo?, tag}.  Specifies the reciprocal tag and the repo that will apply it.  If omitted, the tag
      is its own reciprocal on the local repo, e.g. All A peerOf B => B peerOf A.`,
    {
      repo: h(`(optional) foreign.repo: Name.  The LinkRepo that applies the reciprocal tag.  On the client side, this matters if the foreign
        repo has additional rules for the reciprocal tag.  If both tags belong to the
        local repo, this can be omitted.  Note that this repo will not automatically know the reciprocal rule.`),
      tag: h(`foreign.tag: string.  The reciprocal tag that will link the target of
        the local tag back to the link's base.`)
    })
  }),
  removeAllQuery: h(`removeAllQuery({name}).  Remove all elements in a LinkSet (query result) from the DHT.  Also removes the now empty LinkSet`, {
    name: h(`name: Name.  The LinkSet whose elements should be deleted.  This object will also be removed from your scope.`)
  }),
  data: h(`data({name}) => {data[]}.  Retrieve the data entries that are the targets of the links found by a query and stored
    in a LinkSet.`, {
    name: h(`name: Name.  The LinkSet (Query) object whose data you want.`),
    data: h(`data: Name[].  Normally this would be more interesting, but since we're only linking names to each other here,
      this is just the same list of names you got when the query was done.`)
  }),
  hashes: h(`hashes({name}) => {hashes[]}.  Retrieve the hashes of the targets of the links found by a LinkSet's query.  More useful on the server side.`, {
    name: h(`name: Name.  The query object to retrieve hashes from.`),
    hashes: h(`hashes: Hash[].  They aren't useful on the client side, but here they are!`)
  }),
  tags: h(`tags({query, tags[], dest?}) => {elements[]}.  Filter an existing LinkSet by tag and optionally save it as a new LinkSet.
  Unless query == dest, the query LinkSet is not modified.`, {
    query: h(`query: Name.  The name of an existing LinkSet query result.`),
    tags: h(`tags: string[].  The list of tags that should remain in the result.  All other tags are excluded from the new LinkSet,
      but not the original query or the DHT.`),
    dest: h(`(optional) dest: Name.  If provided, the filtered LinkSet will not only be returned but also saved in the DHT for later use.
      To replace the original query, provide the same name as the old one.`),
    elements: h(`elements: Name[].  The remaining elements in the LinkSet.`)
  }),
  removeLink: h(`removeLink({repo?, base, target, tag}) => {link}.  Remove a link between objects.`, {
    repo: h(`(optional) repo: Name.  The name of a repo that should oversee the
      unlinking to maintain the integrity of the system according to its rules.
      If omitted, reciprocal and predicate links will not be updated.`),
    base: h(`base: Name.  The subject of the link to remove.`),
    target: h(`target: Name.  The object of the link to remove.`),
    tag: h(`tag: string.  The tag that identifies the link to remove.`),
    link: h(`link: string.  A short blurb about what happened.  Reciprocals and predicates removed are not shown.`)
  }),
  removeObject: h(`removeObject({name}).  Removes an object from your scope.  References to the object will dangle,
    and there are no assurances about its links.  Probably, if you make a new object of the same name, those dangling links will point to the new object.
    This isn't really that effective now that I'm explaining it.`, {
    name: h(`name: Name.  The name of the object (of any type) that you want to remove.`)
  }),
  link: h(`link({repo?, base, target, tag}) => {link}.  Links the base object to the target object with the given tag.`, {
    repo: h(`(optional) repo: Name.  The name of a LinkRepo object.  If provided, any rules for the repo will be applied, e.g. reciprocal links, singular links, predicate links.`),
    base: h(`base: Name.  The name of an object of any kind that is the subject of the link.  The link will be searchable from this object.`),
    target: h(`target: Name.  The name of an object that is the object of the link.  It is only possible to search the link from this object with a LinkRepo.`),
    tag: h(`tag: string.  A tag that names the relationship between the linked objects.  Used to filter query results.`),
    link: h(`link: string.  A short description of the operation in link-ese.  Side effects enacted by the LinkRepo to satisfy its rules are not shown.`)
  }),
  createQuery: h(`createQuery({name?, repo, base, tag?}) => elements[].  Create a new LinkSet object on the server by querying a LinkRepo`, {
    name: h(`(optional) name: Name.  The name of the new LinkSet object.  If provided, you can use this name in subsequent query methods.`),
    repo: h(`repo: Name.  The name of the LinkRepo object that will perform the query.`),
    base: h(`base: Name.  The name of an object that is the subject of the query.  Outward links from this object are returned.`),
    tag: h(`(optional) tag: string.  If provided, only links with this tag are returned.`),
    elements: h(`elements: Name[].  The names of the objects found by the query.`)
  }),
  dump: h(`dump({names[]?, tags[]?, links?, rules?, elements?}) => report.  Displays some or all data on the server.`, {
    names: h(`(optional) names: Name[].  If included, only data from the given names is returned.`),
    tags: h(`(optional) tags: string[].  If included, the only links returned will have one of these tags.`),
    links: h(`links: boolean = true.  Return the links from each object if true or missing.`),
    rules: h(`rules: boolean = true.  Return LinkRepo rules from objects that have them if true or missing.`),
    elements: h(`elements: boolean = true.  Return LinkSet results from objects that have them if true or missing`),
    report: h(`{ [name]: {links[], rules[], elements[]} }.  Data on the server/DHT.`, {
      name: h(`name: Name.  The name of an object is the key for its data`),
      links: h(`links: html[].  A list of the links from the object`),
      rules: h(`rules: html[].  A list of assurances a LinkRepo provides about the tags it processes.`),
      elements: h(`elements: Name[].  A list of names of objects that were the result of a query via LinkSet`)
    })
  }),
  createRepo: h(`createRepo({name}).  Creates a LinkRepo object.`, {
    name: h(`name: string.  the name of the LinkRepo`)
  }),
  createObject: h(`createObject({name}).  Creates an opaque object.`, {
    name: h(`name: string.  the name of the object.`)
  })

}

function Zome(name, fnTypes) {
  function send(fnName, data) {
    return new Promise((yes, no) => {
      const xhr = new XMLHttpRequest();
      xhr.open(`POST`, `fn/${name}/${fnName}`);
      xhr.responseType = `json`;
      xhr.overrideMimeType(`application/json`);
      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;
        if (xhr.status !== 200) {
          no(`${xhr.status} ${xhr.statusText}`);
        } else {
          yes(xhr.response);
        }
      };
      xhr.send(JSON.stringify(data));
    });
  }

  for (let fn of fnTypes) {
    this[fn] = (arg) => send(fn, arg);
    this[fn].help = help[fn];
  }
}

const allMethods = [
  `createObject`, `createRepo`, `dump`, `createQuery`, `link`, `removeObject`,
  `removeLink`, `tags`, `hashes`, `data`, `removeAllQuery`, `reciprocal`,
  `predicate`, `singular`
];
const zome = new Zome(`repo`, allMethods);


const repoMethods = [
  `link`, `removeLink`, `createQuery`, `reciprocal`, `predicate`, `singular`,
  `dump`
];
zome.repo = new Zome(`repo`, repoMethods);

const queryMethods = [
  `removeAllQuery`, `tags`, `hashes`, `data`, `dump`
];
zome.query = new Zome(`repo`, queryMethods);

const globalMethods = [
  `createObject`, `createRepo`, `dump`, `createQuery`, `link`, `removeObject`,
  `removeLink`
];
zome.global = new Zome(`repo`, globalMethods);


function helpOn(methods) {
  let obj = {};
  for (let key of methods) {
    obj[key] = help[key];
  }
  return obj;
}

zome.global.help = h(`global has all the functions that either do not require an
  object to exist to work, or that can be applied to any object no matter what it
  is.`, helpOn(globalMethods));

zome.repo.help = h(`repo has the functions that would be a LinkRepo's own methods
  if you were on the server side.  You're missing out.`, helpOn(repoMethods));

zome.query.help = h(`query has functions that mirror those of LinkSets on the
  server.  LinkSets are the results of queries through a LinkRepo.`, helpOn(queryMethods));

zome.help = h(`All zome modules and functions have a .help.  All .help also have
  additional details about topics in the method or zome summary.

  There are 3 classes on the server to play with, and each has their own slightly
  overlapping module of this zome object.`,
  {
    help: h(`A method foo like foo(bar) => baz will have details for arguments (foo.help.bar())
      and returns (foo.help.baz()).
      All help details are also helps, so if baz is an object with aProperty,
      foo.help.baz.aProperty() would tell you about it.
    `),
    global: zome.global.help,
    repo: zome.repo.help,
    query: zome.query.help
  }
);

window.zome = zome;
window.repl = repl;
