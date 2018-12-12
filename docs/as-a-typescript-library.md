# LinkRepo as a TypeScript Library

How you include LinkRepo in your project will depend on how you have worked out
the problem of including _anything_ in your holochain project.  If your source
is in TypeScript, you will presumably want the symbols in LinkRepo to be
available for development via `import`.  However, what you want at compilation
is for the _code_ in LinkRepo to be available, and that means inevitably glomming
the library onto the top of your code.

If you have developed a method for this purpose for your own sources, you will
want to adapt the following files to this method:

- `src/LinkRepo.ts`
- `src/shims.js` & `.d.ts`
- `src/ex-array-shim.js` & `.d.ts`

Alternatively, you can use the pre-compiled version of the library:

- `bin/LinkRepo.js`
- `bin/LinkRepo.d.ts`

In this case, you _still_ need to glom `LinkRepo.js` to source files that use it,
but you will do so _after they are compiled_.  That frees you from any adaptation
or maintenance of this library itself, and the `.d.ts` will provide the same
support during development in TypeScript.

The caveat here is that you may get name clashes from the all-in-one files.
Specifically, you may find the compiler complaining that the shims are doubly
defined.

# Re-building

As of today (12/12/18) the pre-built version is current.  If you want to re-build
it anyway, run the script `build/build.sh`.  That will deposit a fresh copy of
`LinkRepo.js` in the `bin` folder.
