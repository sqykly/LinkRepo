# `LinkRepo`

LinkRepo stands for “Link Repository”.  It is a TypeScript library that presents an object-oriented, type-safe, and uncomplicated interface for using Holochain links.  Developers can choose to use a LinkRepo to simply object-orient and type-safe their link entries, or to emulate foreign key fields of a traditional relational object.  Using its link management features, it is possible to emulate one-to-one fields, one-to-many fields, and many-to-many fields as well with no additional effort when the fields are used.

## What it isn’t

- A repo is not a links entry type.  A single object is limited to get and commit to one links entry type, but the link management features have no such restriction.  In addition, every repo object can narrow its view of its entry type selectively to include only certain other entry types as base or link, or by the tags it can use.
- A repo is not a set of parameters to getLinks.  It does do that to reduce repetition, but the management features are an entirely new way to build arbitrarily complex systems of links and use them with no possibility of error or expansion of the efforts to use them.

## What is it then?

The repo object itself is a view or a subset of a links entry type.  What that view can see is fairly fine-grained, ranging from the whole entry type to just a single tag or a type of object in that entry type just as easily.  This view is paired with a set of user-defined rules that lead to assurances about how the tags are related semantically.

## Type Safety

The Holochain native links are like the wild west.  There are no restrictions that can find and prevent typographical errors or type mismatches early.  There are no schema to provide assurances about the fields the recovered objects from getLinks will have.  If every coder on the project is a genius expert, that’s not a big deal, but in general, misunderstandings and fading memories will cause objects to be linked as they were not intended.

Repos solve these issues using the TypeScript compiler’s zeal for type safety.  A repo can have a (immutable) list of entry types as short or as long as desired.  If given the wrong entry type, the code simply will not compile.  The IDE will tell the programmer before compilation, too.  A mistaken identity will not get far.  The Base and Link Target fields can have separate type restrictions, even a Target type that doesn’t belong in the repo’s own links type, and the types will be enforced when their relationships are defined.  TypeScript types are exceptionally expressive, so the tags have just as much protection.  Telling the repo to query or commit a tag it doesn’t know about is a compilation error.  

They are good for more than just producing errors, though.  They ensure that the developer always has perfect content assist (intellisense) documentation when the target entries are retrieved.  Content assist also provides the list of tags and types while the developer is typing out a query or a commit.  It’s informative and absolutely impossible to mess up with links managed in a repo.

## Management Features

If a developer designs a linking scheme wherein certain tags have a reciprocal link back to the original, the code volume used to operate with that system is doubled.  If there are other operations with links that are related in some way, double it again.  These link-pair relationships are being spelled out every time they are used, but the DRY principle suggests we declare the relationship and never reveal its details again.  A LinkRepo has a mechanism for doing just that.  Consider: 

* My entries are all boxes.
* Many boxes are inside other boxes.
* A box can hold many smaller boxes.

My app is going to keep track of these boxes as someone moves them about and reconfigures them.  Suppose he is moving or something.  I have three tags: `insideOf`, `contains`, and `nextTo`.  Every time this user takes a box **A** out of box **B** and puts it in box **C**, my app must:
1. For all **N** `nextTo` **A**,
   - Remove the link **N** `nextTo` **A**
   - Remove the link **A** `nextTo` **N**
2. Remove the link **A** `insideOf` **B**
3. Remove the link **B** `contains` **A**
4. For all **N** `insideOf` **C**
   - Commit link **A** `nextTo` **N**
   - Commit link **N** `nextTo` **A**
5. Commit the link **C** `contains` **A**
6. Commit the link **A** `insideOf` **C**

With a repo, all of that can be reduced to 2 operations: #2 and #6 (#3 and #5 will work just as well).  By elaborating the rules of what it means semantically to be `insideOf` a box, the side effects of adding or removing any link are automated and immune to silly programming errors.

## Simulated Fields

The capability to automate the management of all of a tag’s relationships leads easily to building typical relational fields such as Foreign Key, One to One, One to Many, and Many to Many.  While foreign keys are emulated simply by having a link or a hash-valued field on the entry type, the rest of those types have invariants that need to be maintained when they are created, set, modified, or deleted.  LinkRepos can hold the system to those invariants without further intervention once they are decoded into link pairs.  While it doesn’t ship with a field object (now), all of those categories have been realized as simulated properties on a real live object.  

A person appears in HC Dev chat asking why links aren’t relational fields pretty regularly.  Well, now they are.

## Queries

Probably the 3rd most convenient feature of LinkRepo is the class of the objects it returns from get : `LinkSet`s.  For the most part, these are a lot like an array of link structures just like the returns from `getLinks` - in fact, they inherit from `Array` and are full of those structures.  However, they also have some important filtering and mapping capabilities, as well as allowing the user to affect the links they received by removing or replacing them on the DHT.  There are no steps or loops that way; just a single line explanation of which links are being targeted and finally, what is to happen to them.

The nature of the getLinks function and links themselves prevents them from ever being queries in a true sense (not a criticism, just different).  But returning an object that has powerful filters, maps, and mutators feels good to people accustomed to DB-driven APIs.
