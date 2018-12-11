# `LinkRepo` REPL Test System

As `LinkRepo` is a code library, it only makes sense to use it from code.
Thus, the REPL test system creates an environment in the browser that exposes the
`LinkRepo` interface to client-side JS that you can enter into a `textarea`.

**Note**

Code that consumes the test system client-side interface looks _nothing_ like
server-side typescript that includes the project.  The test system is a fast
way to demo what you can do with the library and set up simple systems to see
how corresponding systems on the server would behave.

## Getting Started

To build:

    $ source sample/build/build.sh

It's pre-built as of now (12/7/18) but it can't hurt.

Run with `hcdev`, `hcd`, etc.  Visit index.html.

## Running Commands

Type JavaScript code into the `textarea`.  The global variable `zome` contains
all functions related to `LinkRepo` on the server side.  Click "Run" and the
code will be echoed to the output.  When the command completes, the result will
appear beneath the echo.

To repeat a previous command, click the echo, and it will replace the text in
the input.

All methods of `zome` are asynchronous, so if you want to run multiple methods
in one command, consider separating them with `then`.  By the same token, if
you enter code that returns a `Promise`, the REPL will respond to its success or
failure similarly to the server's.

## Objects on the Test System

Objects you create and store on the server are opaque to the test system.  This
is exactly the case with non-links entries in a real holochain app; `LinkRepo`
and links entries are not concerned with their (possibly corresponding) JSON
entries.  They simply serve as placeholders that can be linked together.

The objects you create through `zome.createObject` or `zome.global.createObject`
are not `var`s on the client or the server.  They only exist as entries on the
DHT that are anchored to the current agent.

There are two cases where "special" properties will allow the test system
to perform additional operations using the object's identifiers as proxies.

### Repos

`LinkRepo` objects are created on the server when you call any method in
`zome.repo`.  When you add relational rules to a `LinkRepo` object via the methods
`reciprocal`, `singular`, and `predicate`, the changes are frozen into a `Repo`
entry.  When you manipulate links through the test system using `link` or
`removeLink`, those relationships are thawed from the entry and applied.

Please note that, because the rule-adding functions are separate operations that
will affect one entry (the repo), it is not possible to run more than one as a
batch just by typing all of the commands into the REPL at once and running it.
To define multiple rules for one repo, separate them into sequential `then` calls.
Example:

    zome.repo.reciprocal(...).then(
      () => zome.repo.singular(...)
    ).then(
      () => zome.repo.predicate(...)
    )


### Queries

`Query` entries represent frozen `LinkSet` objects that a TypeScript source would
receive from a `LinkRepo`'s `get()` method.  They are created in the test system
by the `createQuery` method, which currently fails to bind the results to the
object name, so don't worry about those.

You can see that `LinkSet` does work, however, by running `zome.dump` and seeing
anything at all.  If it didn't work, none of the operations you _can't_ see
would be successful either.

## Documentation on Methods

Documentation can be obtained from the REPL by entering:

    zome

or

    zome.help

or

    zome.help()

or any of

    zome.repo
    zome.query
    zome.global

or

    zome.repo.help // you get the picture, right?

or by typing the name of _any_ function into the REPL and hitting run.
Functions, arguments, and returns are annotated and hyperlinked.

## Examples

### Setting up a one-to-many field

Create a repo, `oneToMany`:

    zome.global.createRepo({name: `oneToMany`});

Define two global constants that will represent our tags, `one` and `many`.  This
step is not necessary, but will make writing it quicker.  Both are objects
that specify the repo name and their tag name:

    window.one = { repo: `oneToMany`, tag: `one` };
    window.many = { repo: `oneToMany`, tag: `many` };

Define the `one` tag as one-per-object:

    zome.repo.singular(one);

Define the `many` tag as the reciprocal of `one`:

    zome.repo.reciprocal({ local: one, foreign: many });

Define the `one` tag as the reciprocal of `many`:

    zome.repo.reciprocal({ local: many, foreign: one });

To see if it works, create some test objects:

    Promise.all([
      zome.global.createObject({name: `foo`}),
      zome.global.createObject({name: `bar`}),
      zome.global.createObject({name: `spam`}),
      zome.global.createObject({name: `eggs`})
    ]);

Define a quick helper function to generate the long-ish list of arguments we
need from two names and one of the tag constants from earlier.  Again, this is
not necessary, but makes it quicker to type out.

    window.link = function (base, tag, target) {
      return zome.repo.link(Object.assign({base, target}, tag));
    }

Link `foo` and `bar` to `one` `spam` to verify that `many` is applied in reverse,
and that there can be an arbitrary number of objects linked with `many`:

    Promise.all([
      link(`foo`, one, `spam`),
      link(`bar`, one, `spam`)
    ]).then(
      () => zome.global.dump({})
    )

As you can see under `spam`'s links, it now `many` both `foo` and `bar`.  Now to
verify that applying `many` will affect `one` links as expected.  We will simply
link `eggs many foo`, and we expect:

- A new link, `eggs many foo` will appear.
- A new link, `foo one eggs` will appear to respect the rule that a `many` link
must have a reciprocal `one` link.
- `foo`'s current `one` link to `spam` will be removed to respect the rule that
there can only be one `one` link from an object.
- `spam`'s current `many` link to `foo` will be removed as a result to respect
the rule that a `one` link must have a reciprocal `many` link.

To accomplish all that, we only need to add a single link:

    link(`eggs`, many, `foo`).then(
      () => zome.global.dump({})
    )

As you can see, all of our expectations have held up.  By linking and unlinking
through the repo with the rules we applied, `one` and `many` are effectively
a one-to-many field.
