/**
 * The original library goes here
 */

import "./holochain-proto";
//import "./es6";
import "./shims";
import "./ex-array-shim";

 /**
  * This is for type safety when you need assurance that get(Hash) will return the correct type.
  * Not sure if it's working this way, but type safety for returns from get()
  * is still good.
  */
declare type Hash<T> = holochain.Hash;

 /**
  * The hash you get when commiting a holochain.LinksEntry
  */
declare type LinkHash = Hash<holochain.LinksEntry>;

 /**
  * Either throw the error or return the desired result.  The type parameter
  * should usually be inferred from the argument, which will have better warnings
  * downstream.
  */
function notError<T>(maybeErr: holochain.CanError<T>): T {
  if (isErr(maybeErr)) {
    throw new Error(`That was an error! ${``+maybeErr}`);
  } else {
    return (<T> maybeErr);
  }
}

interface LinkReplacement<T, Tags> {
 hash: Hash<T>;
 tag: Tags;
 type: string;
}

interface LinkReplace<T, Tags> extends LinkReplacement<T, Tags> {
 readonly entry: T;
}

 /**
  * Tool for getting what you need from linkRepo.get() and preserving Hash types
  * and iterating with for...of
  * The type parameter is the type of the Link elements
  * It provides filter methods (tags, types, sources) to narrow your results,
  * and the output will be another LinkSet.
  * Get an array of entries (data()) or hashes (hashes())
  * It wants to be a Set, but targetting compilation to ES5 will only allow
  * arrays to be for..of'ed
  *
  */
  class LinkSet<B, L, Tags extends string = string, T extends L = L> extends ExArray<holochain.GetLinksResponse> {
    /**
     * typeof linkSet.BASE provides the base type the linkSet links from.
     */
    readonly BASE: B;
    /**
     * typeof linkSet.LINK provides the types the linkSet can link to.
     */
    readonly LINK: L;
    /**
     * typeof linkSet.TAGS gives the string literal types that can be used as tags.
     * note that this is not a string or array of strings, it is a type.  Best
     * used to type-check a tag you are about to use, i.e.
     * let tag: typeof linkSet.TAGS = "foo"
     * in that case a compilation error will occur if "foo" is not an acceptable
     * tag.
     */
    readonly TAGS: Tags;
    /**
     *
     */
    readonly TYPE: T;

    /**
     * Don't new this.
     */
    constructor(array: Array<holochain.GetLinksResponse>, private origin: LinkRepo<B,L,Tags>, private baseHash: string, onlyTag?: string, private loaded: boolean = true) {
      super(...array);

      if (onlyTag) {
        this.forEach((item: holochain.GetLinksResponse) => {
          item.Tag = onlyTag;
        });
      }
    }
    /**
     * Filter by any number of tags.  Returns a new LinkSet of the same type.
     * @param {string[]} narrowing An array of the tag names wanted.
     */
    tags<Tt extends T>(...narrowing: string[]): LinkSet<B, L, Tags, Tt> {
      let uniques = new Set(narrowing);
      return new LinkSet<B, L, Tags, Tt>( this.filter( ({Tag}) => uniques.has(Tag) ), this.origin, this.baseHash );
    }

    /**
     * Filter by any number of entryTypes, which you should probably get from HoloObj.className
     * returns a new LinkSet.
     * if you like typesafety, use the type parameter to narrow the types, too.
     * @arg C Type or union of types that the result should contain.  These are classes, not names.
     * @params {string} typeNames is the list of types that the result should have.
     *  these are the type names, not the classes.
     * @returns {LinkSet<C>}
     */
    types<C extends T = T>(...typeNames: string[]): LinkSet<B,L,Tags,C> {
      let uniques = new Set<string>(typeNames);
      return new LinkSet<B,L,Tags,C>(this.filter( ({EntryType}) => uniques.has(EntryType) ), this.origin, this.baseHash);
    }

    /**
     * Returns an array of Hashes from the LinkSet, typed appropriately
     */
    hashes(): Hash<T>[] {
      return this.map( ({Hash}) => Hash);
    }

    /**
     * Returns the entries in the LinkSet as a typesafe array.
     */
    data(): T[] {
      return this.map( ({Hash}) => <T>notError(get(Hash)));
    }

    /**
     * Filters by source.
     * @param {holochain.Hash} ... allowed sources to be allowed
     */
    sources(...allowed: holochain.Hash[]): LinkSet<B,L,Tags,T> {
      let uniques = new Set<holochain.Hash>(allowed);
      return new LinkSet<B,L,Tags,T>(this.filter( ({Source}) => uniques.has(Source) ), this.origin, this.baseHash);
    }

    /**
     * All links in this set will be removed from the DHT.  Note that this is not
     * chainable, and the original object will be empty as well.
     */
    removeAll(): void {
      this.forEach( (link: holochain.GetLinksResponse, index:number) => {
        let target = link.Hash, tag = link.Tag;
        try {
          this.origin.remove(this.baseHash, target, <Tags>tag);
        } catch (e) {
          // don't care, just keep deleting them.
        }
      });
      let foo = this.splice(0, this.length);
    }

    /**
     * Filters and replaces elements of the set.  Provide a function that accepts
     * a LinkReplace ({hash, tag, type, entry}) and returns a LinkReplacement
     * ({hash, tag, type}).  Return undefined or the unmodified argument to leave
     * the link alone.  Return null to have the link deleted, both from the set
     * and the DHT.  Return false to remove the link from the set without deleting
     * on the DHT.  Otherwise, return the new {hash, tag, type}.
     * @returns {this}
     */
    replace(fn: (obj: LinkReplace<T, Tags>) => LinkReplacement<T, Tags>|false): this {
      const {length, origin} = this;
      const removals: number[] = [];

      for (let i = 0; i < length; i++) {
        const {EntryType: type} = this[i];
        let hash = <Hash<T>>this[i].Hash;
        let tag = <Tags>this[i].Tag;

        let entry = get(hash);

        if (!isErr(entry)) {
          let rep = fn({hash, tag, type, entry});
          if (rep === null) {
            origin.remove(this.baseHash, hash, tag);
            removals.push(i);
          } else if (rep === false) {
            removals.push(i);
          } else if (rep && (tag !== rep.tag || hash !== rep.hash)) {
            if (hash === rep.hash && type !== rep.type) {
              throw new TypeError(`can't link to ${type} ${hash} as type ${rep.type}`);
            }
            origin.remove(this.baseHash, hash, tag);
            tag = rep.tag;
            hash = rep.hash;
            origin.put(this.baseHash, hash, tag);
            this[i] = {
              EntryType: rep.type,
              Tag: tag,
              Hash: hash
            };
          }
        } else {
          removals.push(i);
        }
      }

      for (let i of removals) {
        this.splice(i, 1);
      }

      return this;
    }

    /**
     * Go through the set link by link, accepting or rejecting them for a new
     * LinkSet as you go.  The callback should accept a {type, entry, hash, tag}
     * and return a boolean.
     */
    select(fn: (lr: LinkReplace<T, Tags>) => boolean): LinkSet<B, L, Tags, T> {
      let chosen = new LinkSet<B, L, Tags, T>([], this.origin, this.baseHash);

      for (let response of this) {
        let {EntryType: type, Hash: hash} = response;
        let tag = <Tags> response.Tag;
        let entry = <T>notError(get(hash));
        if (fn({type, entry, hash, tag})) chosen.push(response);
      }

      return chosen;
    }

    private descEntry(args: {Hash: Hash<B>, Tag?: string, EntryType?: string}): string {
      const {Hash, Tag, EntryType} = args;
      return `${Tag || `no-tag`} ${Hash}:${EntryType || `no-type`}`;
    }

    private desc(): string[] {
      return this.map(this.descEntry);
    }

    notIn<Bn extends B, Ln extends L, TagsN extends Tags, Tn extends Ln>
    (ls: LinkSet<Bn,Ln,TagsN,Tn>): LinkSet<B,L,Tags,T> {
      if (ls.origin !== this.origin || ls.baseHash !== this.baseHash) {
        return new LinkSet(this, this.origin, this.baseHash);
      }
      const inLs = new Set<string>(ls.desc());

      return new LinkSet(
        this.filter((link) => {
          return !inLs.has(this.descEntry(link));
        }),
        this.origin,
        this.baseHash,
        undefined,
        this.loaded
      );
    }

    andIn<La extends L, TagsA extends string, Ta extends La>
    (ls: LinkSet<B,La,TagsA,Ta>): LinkSet<B, L, Tags, T> {

      if (this.baseHash !== ls.baseHash) {
        return new LinkSet([], this.origin, this.baseHash);
      }

      const inLs = new Set<string>(ls.desc());

      return new LinkSet(
        this.filter((link) => inLs.has(this.descEntry(link))),
        this.origin,
        this.baseHash,
        undefined,
        this.loaded
      );
    }

   serial(): QueryEntry {
     return {
       array: [...this],
       baseHash: this.baseHash,
       origin: this.origin.userName
     };
   }

   save(): Hash<QueryEntry> {
     const entry = this.serial();

     const hash = notError(commit(`Query`, entry));
     this.forEach(({Hash: el}) => {
       elements.put(hash, el, `element`);
     });
     return hash;
   }

   static load(repo: Name, base: Hash<Name>) {

   }

   static revive(qe: QueryEntry): LinkSet<Name, Name, string, Name> {

     return new LinkSet<Name, Name, string, Name>(
       qe.array,
       LinkRepo.revive(repos.get(hashByName(qe.origin), `repo`).data()[0]),
       qe.baseHash
     );
  }
}

interface Tag<B,L, T extends string> {
   tag: T,
   repo: LinkRepo<B,L,T>
}

/**
 * LinkRepo encapsulates all kinds of links.  Used for keeping track of reciprocal
 * links, managing DHT interactions that are otherwise nuanced, producing
 * LinkSet objects, maintaining type-safe Hash types, and defending against
 * recursive reciprocal links.
 * @arg {object} B The union of types that can be the Base of the Links
 * @arg {object} L The union of types that can be the Link of the Links
 *  If there are reciprocal links within this LinkRepo, it's safest for B and L
 *  to be identical.
 * @arg {string} T.  This is a union of the tag strings used in this repo.
 *  If you don't want to know when you put the wrong tag in the wrong Repo, go
 *  ahead and let it default to string.  Do not use tags that include the pipe
 *  character, '|'; union the strings themselves like "foo"|"bar"|"baz"
 */
class LinkRepo<B, L, T extends string = string> {
	userName: any;
  /**
   * @param {string} name the exact dna.zomes[].Entries.Name that this repo will
   *  represent.
   */
  constructor (protected name: string) {}

  protected backLinks = new Map<T, Tag<L|B,B|L, T|string>[]>();
  /*
  protected recurseGuard = new Map<T, number>();
  /*/
  protected recurseGuard = new Set<string>();
  protected guard(base: Hash<B>, link: Hash<L>, tag: T, op: '+'|'-', fn: () => void) {
   const descript = `${base} ${op}${tag} ${link}`;
   if (!this.recurseGuard.has(descript)) {
     this.recurseGuard.add(descript);
     fn();
     this.recurseGuard.delete(descript);
   }
  }
  /**/
  protected selfLinks = new Map<T, T[]>();
  protected predicates = new Map<
   T,
   { query: Tag<L|B, B|L, T|string>, dependent: Tag<L|B, B|L, T|string> }[]
  >();
  protected exclusive = new Set<T>();
  readonly BASE: B;
  readonly LINK: L;
  readonly TAGS: T;

  tag<Ts extends T>(t: Ts): Tag<B, L, T> {
   return { tag: t, repo: this };
  }
  /**
  * Produce a LinkSet including all parameter-specified queries.
  * @param {Hash<B>} base this is the Base entry  whose outward links will
  *  be recovered.
  * @param {string} tag this is the tag or tags you want to filter by.
  *  If given an empty string or omitted, all links in this repo are retrieved.
  *  To allow multiple tags to be returned, put them in this string separated
  *  by the pipe character ('|')
  * @param {holochain.LinksOptions} options options that will be passed to getLinks
  *  Be aware that the LinkSet will NOT know about these.  Defaults to the default
  *  LinksOptions.
  * @returns {LinkSet<B>} containing the query result.
  */
  get(base: Hash<B>, ...tags: T[]): LinkSet<B,L,T,L> {
   const options = {Load: true};
   if (tags.length === 0) {
     return new LinkSet<B,L,T,L>(<holochain.GetLinksResponse[]> notError(getLinks(base, '', options)), this, base);
   }
   let responses: holochain.GetLinksResponse[] = [];

   for (let tag of tags) {
     let response = <holochain.GetLinksResponse[]>getLinks(base, tag, options);
     for (let lnk of response) {
       lnk.Tag = tag;
     }
     responses = responses.concat(response);
   }

   return new LinkSet<B,L,T,L>(responses, this, base);
  }

  /**
  * Commits a new link to the DHT.
  * @param {Hash<B>} base the base of the link.  This is the object you can query by.
  * @param {Hash<L>} link the linked object of the link.  This is the object you
  *  CAN'T query by, which is the object of the tag.
  * @param {T} tag the tag for the link, of which base is the object.
  * @param {LinkRepo<L, B>?} backRepo optional repo that will contain a reciprocal
  *  link.  Any reciprocals already registered via linkBack() are already covered;
  *  Use that method instead when possible.
  * @param {string?} backTag optional but mandatory if backRepo is specified.
  *  this is the tag used for the reciprocal link in addition to those already
  *  entered into the repo; there is no need to repeat this information if
  *  the reciprocal has been entered already via linkBack
  * @returns {LinkHash} a hash of the link, but that's pretty useless, so I'll probably end up changing
  *  it to be chainable.
  */
  put(base: Hash<B>, link: Hash<L>, tag: T, backRepo?: LinkRepo<L, B>, backTag?: string): this {
   /*
   const rg = this.recurseGuard;
   let rgv = rg.has(tag) ? rg.get(tag) : 1;

   if (!rgv--) return this;

   if (this.exclusive.has(tag)) {
     this.get(base, tag).removeAll();
   }
   rg.set(tag, rgv);



   if (this.predicates.has(tag)) {
     this.addPredicate(tag, base, link);
   }

   const hash = commit(this.name, { Links: [{Base: base, Link: link, Tag: tag}] });


   if (this.backLinks.has(tag)) {
     for (let backLink of this.backLinks.get(tag)) {
       let {repo, tag: revTag} = backLink;
       repo.put(link, base, revTag);
     }
   }
   if (this.selfLinks.has(tag)) {
     for (let revTag of this.selfLinks.get(tag)) {
       this.put(link, base, revTag);
     }
   }
   if (backRepo && backTag) {
     backRepo.put(link, base, backTag);
   }

   rg.set(tag, ++rgv);
   /*/
   this.guard(base, link, tag, '+', () => {
     if (this.exclusive.has(tag)) {
       this.get(base, tag).removeAll();
     }
     if (this.predicates.has(tag)) {
       this.addPredicate(tag, base, link);
     }

     const hash = commit(this.name, { Links: [{Base: base, Link: link, Tag: tag}] });

     if (this.backLinks.has(tag)) {
       for (let backLink of this.backLinks.get(tag)) {
         let {repo, tag: revTag} = backLink;
         repo.put(link, base, revTag);
       }
     }
     if (this.selfLinks.has(tag)) {
       for (let revTag of this.selfLinks.get(tag)) {
         this.put(link, base, revTag);
       }
     }
     if (backRepo && backTag) {
       backRepo.put(link, base, backTag);
     }
   })
   /**/
   return this;
  }

  /**
  * Adds a reciprocal to a tag that, when put(), will trigger an additional
  * put() from the linked object from the base object.
  * @param {T} tag the tag that will trigger the reciprocal to be put().
  * @param {LinkRepo<L,B,string>} repo The repo that will contain the reciprocal.
  * @param {string} backTag the tag that will be used for the reciprocal link.
  * @returns {ThisType}
  */
  linkBack(tag: T, backTag: T|string = tag, repo?: LinkRepo<L|B, B|L, string>): this {
   backTag = backTag || tag;
   if (!repo || repo === this) {
     return this.internalLinkback(tag, <T>backTag);
   }
   const entry = { repo, tag: backTag };
   if (this.backLinks.has(tag)) {
     let existing = this.backLinks.get(tag);
     existing.push(entry);
   } else {
     this.backLinks.set(tag, [entry]);
   }
   //this.recurseGuard.set(tag, 1);
   return this;
  }

  // box example:
  // on A -insideOf B, for N: B contains N { N -nextTo A; A -nextTo N }
  // on A +insideOf B, for N: B contains N { N +nextTo A; A +nextTo N }
  /**
  * NOT WELL TESTED
  * Expresses a rule between 3 tags that ensures that any A triggerTag B,
  * all C where B query.tag C, also C dependent.tag A
  * The reverse should also be true; if not A triggerTag B, any C where
  * B query.tag C, not C dependent.tag A
  */
  predicate<T2 extends string = T, T3 extends string = T>(
   triggerTag: T,
   query: { tag: T2, repo: LinkRepo<L|B, B|L, T2|T> },
   dependent: { tag: T3, repo: LinkRepo<L|B, B|L, T3|T> }
  ): this {
   let {predicates} = this;
   if (!query.repo) query.repo = this;
   if (!dependent.repo) dependent.repo = this;

   if (predicates.has(triggerTag)) {
     predicates.get(triggerTag).push({query, dependent});
   } else {
     predicates.set(triggerTag, [{query, dependent}]);
   }

   return this;
  }

  /**
  * NOT WELL TESTED
  * When adding a link with the given tag, this repo will first remove any links
  * with the same tag.  This is for one-to-one and one end of a one-to-many.
  */
  singular(tag: T): this {
   this.exclusive.add(tag);
   return this;
  }

  private addPredicate(trigger: T, subj: Hash<B>, obj: Hash<L>) {
   const triggered = this.predicates.get(trigger);

   for (let {query, dependent} of triggered) {
     let queried = query.repo.get(obj, query.tag).hashes();
     for (let q of queried) {
       dependent.repo.put(q, subj, dependent.tag);
     }
   }
  }

  private removePredicate(trigger: T, subj: Hash<B>, obj: Hash<L>) {
   const triggered = this.predicates.get(trigger);

   for (let {query, dependent} of triggered) {
     let queried = query.repo.get(obj, query.tag).hashes();
     for (let q of queried) {
       dependent.repo.remove(q, subj, dependent.tag);
     }
   }
  }

  private internalLinkback(fwd: T, back: T): this {
   const mutual = fwd === back;
   if (this.selfLinks.has(fwd)) {
     this.selfLinks.get(fwd).push(back);
   } else {
     this.selfLinks.set(fwd, [back]);
   }
   /*
   if (mutual) {
     this.recurseGuard.set(fwd, 2);
   } else {
     this.recurseGuard.set(fwd, 1).set(back, 1);
   }
   */
   return this;
  }
  private toLinks(base: Hash<B>, link: Hash<L>, tag: T): holochain.LinksEntry {
   return { Links: [{ Base: base, Link: link, Tag: tag }] }
  }

  private unLinks(links: holochain.LinksEntry): {Base: Hash<B>, Link: Hash<L>, Tag: T} {
   let {Base, Link, Tag} = links.Links[0];

   return {Base: <Hash<B>>Base, Link: <Hash<L>>Link, Tag: <T>Tag};
  }

  /**
  * Gets the hash that a link would have if it existed.  Good to know if you use
  * update() and remove()
  * @param {Hash<B>} base the subject of the hypothetical link.
  * @param {Hash<L>} link the object of the hypothetical link.
  * @param {T} tag the tag of the hypothetical link.
  * @returns {LinkHash} if the list does or will exist, this is the hash it
  *  would have.
  */
  getHash(base: Hash<B>, link: Hash<L>, tag: T): LinkHash {
   return notError<LinkHash>(
     makeHash(this.name, this.toLinks(base, link, tag))
   );
  }

  // FIXME this looks pretty gnarly
  /**
  * Remove the link with the specified base, link, and tag.  Reciprocal links
  * entered by linkBack() will also be removed.
  * @param {Hash<B>} base the base of the link to remove.
  * @param {Hash<L>} link the base of the link to remove.
  * @param {T} tag the tag of the link to remove
  * @returns {LinkHash} but not really useful.  Expect to change.
  */
  remove(base: Hash<B>, link: Hash<L>, tag: T): this {
   let presentLink = this.toLinks(base, link, tag);
   let hash = notError<LinkHash>(makeHash(this.name, presentLink));
   // ADD THIS BACK ONCE I KNOW WHAT IS GOING ON WITH REPO UPDATES
   //if (get(hash) === HC.HashNotFound) return this;

   /*
   const rg = this.recurseGuard;
   let rgv = rg.has(tag) ? rg.get(tag) : 1;
   if (!rgv--) {
     return this;
   }

   //if (get(hash) === HC.HashNotFound) return this;

   presentLink.Links[0].LinkAction = HC.LinkAction.Del;
   hash = notError<LinkHash>(commit(this.name, presentLink));

   rg.set(tag, rgv);

   if (this.backLinks.has(tag)) {
     for (let {repo, tag: backTag} of this.backLinks.get(tag)) {
       repo.remove(link, base, backTag);
     }
   }
   if (this.selfLinks.has(tag)) {
     for (let back of this.selfLinks.get(tag)) {
       this.remove(link, base, back);
     }
   }
   if (this.predicates.has(tag)) {
     this.removePredicate(tag, base, link);
   }

   rg.set(tag, ++rgv);
   /*/
   this.guard(base, link, tag, '-', () => {
     presentLink.Links[0].LinkAction = HC.LinkAction.Del;
     hash = notError<LinkHash>(commit(this.name, presentLink));

     if (this.backLinks.has(tag)) {
       for (let {repo, tag: backTag} of this.backLinks.get(tag)) {
         repo.remove(link, base, backTag);
       }
     }
     if (this.selfLinks.has(tag)) {
       for (let back of this.selfLinks.get(tag)) {
         this.remove(link, base, back);
       }
     }
     if (this.predicates.has(tag)) {
       this.removePredicate(tag, base, link);
     }
   });
   /**/
   return this;
  }

  /**
  * If the old link exists, remove it and replace it with the new link.  If
  * the old link doesn't exist, put() the new one.  As always, reciprocal links
  * are managed with no additional work.  Note that both arguments are the
  * holochain.Links type, complete with CamelCaseNames.
  * @param {holochain.Link} old The link to be replaced.
  * @param {holochain.Link} update The link to replace it with.
  * @returns {LinkHash} A hash that you can't use for much.  Expect to change.
  */
  replace(old: holochain.Link, update: holochain.Link): this {
   let oldHash = this.getHash(old.Base, old.Link, <T>old.Tag);
   if (get(oldHash) === HC.HashNotFound) {
     return this.put(update.Base, update.Link, <T>update.Tag)
   }

   this.remove(old.Base, old.Link, <T>old.Tag);
   return this.put(update.Base, update.Link, <T>update.Tag);
  }

   serial(): RepoEntry<Name,Name,string> {
     let back = <{[k in T]: Tagish<B,L,T>[]}>{};
     let exc = <T[]>[];
     let pred = <{[k in T]: { query: Tagish<B,L,T|string>, dependent: Tagish<B,L,T|string> }[]}>{};


     this.backLinks.forEach((blList, tag) => {
       back[tag] = blList.map((bl) => {
         return <Tagish<B,L,T>>{
           tag: bl.tag,
           repo: bl.repo.userName
         };
       });
     });

     this.selfLinks.forEach((tagList, tag) => {
       let list: Tagish<B,L,T>[] = back[tag];
       let tags = tagList.map(((bt) => ({ tag: bt, repo: this.userName })));
       if (list) {
         back[tag] = list.concat(tags);
       } else {
         back[tag] = tags;
       }
     });

     this.exclusive.forEach((tag) => {
       exc.push(tag);
     });

     this.predicates.forEach((predList, tag) => {
       pred[tag] = predList.map(({query: q, dependent: d}) => {
         let query: Tagish<B,L,T|string> = { tag: q.tag, repo: q.repo.userName };
         let dependent: Tagish<B,L,T|string> = { tag: d.tag, repo: d.repo.userName };
         return {query, dependent};
       });
     });

     return {
       name: this.userName,
       backLinks: back,
       exclusive: exc,
       predicates: pred
     };
   }

   static revive
   (re: RepoEntry, guard: Map<Name, UserRepo> = new Map())
   : UserRepo {
     const repo: UserRepo = new LinkRepo("Links");
     repo.userName = re.name;
     guard.set(re.name, repo);

     function reviveTag(t: { tag: string, repo: Name } ): Tag<Name, Name, string> {
       if (guard.has(t.repo)) {
         return { tag: t.tag, repo: guard.get(t.repo) };
       } else {
         let tag = t.tag;
         let got = getRepoEntry(t.repo);
         let repo = LinkRepo.revive(got.entry, guard);
         return { tag, repo };
       }
     }

     for (let key of Object.keys(re.backLinks)) {
       for (let t of re.backLinks[key]) {
         let {tag, repo: targ} = reviveTag(t);
         repo.linkBack(key, tag, targ);
       }
     }

     for (let tag of re.exclusive) {
       repo.singular(tag);
     }

     for (let key of Object.keys(re.predicates)) {
       for (let pred of re.predicates[key]) {
         let {query: q, dependent: d} = pred;
         let query = reviveTag(q);
         let dependent = reviveTag(d);
         repo.predicate(key, query, dependent);
       }
     }

     return repo;
   }

   rules(a: string = "subject", b: string = "object", c: string = "other"): string[] {
     const {backLinks, selfLinks, exclusive, predicates} = this;
     const rules: string[] = [];
     const name = (n:string) => n.italics();
     const foreign = (n:string) => n.bold();
     const tagNear = (n:string, home: LinkRepo<any, any, string> = this) => {
       //if (home.exclusive.has(n)) n = `${n}!`;
       if (home !== this) n = `${foreign(home.userName)}:${n}`;
       return n.fixed();
     }

     const tagFar = (n:string, home: LinkRepo<any,any,string> = this) => {
       return `
        ${home !== this ? `${foreign(home.userName)}:` : ''}${n}
       `.fixed();
     };

     for (let [trigger, bls] of backLinks.entries()) {
       for (let {tag, repo} of bls) {
         rules.push(`
           All ${name(a)} ${tagNear(trigger)} ${name(b)}
           =>
           ${name(b)} ${tagFar(tag, repo)} ${name(a)}
         `);

       }
     }

     for (let [trigger, links] of selfLinks.entries()) {

       for (let tag of links) {
         rules.push(`
           All ${name(a)} ${tagNear(<string>trigger, this)} ${name(b)}
           => ${name(b)} ${tagFar(tag, this)} ${name(a)}
         `);
       }
     }

     for (let [trigger, plist] of predicates.entries()) {
       for (let {query, dependent} of plist) {
         rules.push(`All ${name(a)} ${tagNear(trigger)} ${name(b)}
           => for ${name(c)}
           where ${name(b)} ${tagNear(query.tag, query.repo)} ${name(c)}
           => ${name(c)} ${tagFar(dependent.tag, dependent.repo)} ${name(a)}
         `);
       }
     }

     for (let singular of exclusive.values()) {
       rules.push(`
         All ${name(a)} ${tagNear(singular)} ${name(b)}
         =>
         No ${name(a)} ${tagNear(singular)} ${name(c)}
       `);
     }

     return rules;
   }

}



/**
 * Begin test system
 */

function updateRepo (hash, repo) {
  /* Eh?!  The user link functions prove that remove and put work, yet here,
   * the links "Name repo Repo" persist after updates.  How can this be?
   * Er, it looks fine now with the old JS..  Changing it back....?!?!
   */
  let nhash = hashByName(repo.userName);
  let rhash = notError(commit("Repo", repo.serial()));//notError(update(`Repo`, repo.serial(), hash));
  //repos.get(nhash, `repo`).removeAll();
  repos.remove(nhash, hash, `repo`);
  repos.put(nhash, rhash, `repo`);
}

type Name = string;
interface Tagish<B = any, L = B, T extends string = string> {
  tag: string;
  repo: Name;
}

interface RepoEntry<B = any, L = B, T extends string = string> {
  backLinks: {
    [key in T]: Tagish<L|B, B|L, string>[];
  }
  exclusive: string[];
  predicates: {
    [key in T]: {
      query: Tagish<L|B, B|L, string>,
      dependent: Tagish<L|B, B|L, string>
    }[];
  }
  name: string;
}

interface QueryEntry {
  array: holochain.GetLinksResponse[],
  baseHash: Hash<Name>,
  origin: Hash<RepoEntry>
}

type EntryInfo<T> = {
  name: Name;
  hash: Hash<T>;
  entry: T;
  error?: null;
} | {
  name?: Name;
  hash?: Hash<T>;
  entry?: T;
  error: Error;
}

type UserRepo = LinkRepo<Name,Name,string>;
type UserEntry = RepoEntry<Name,Name,string>;

const priv = `InteriorLinks`
const scope = new LinkRepo<Name, Name, "scope">(priv);
const repos = new LinkRepo<Name, RepoEntry, "repo">(priv);
const queries = new LinkRepo<Name, QueryEntry, "query">(priv);
const elements = new LinkRepo<QueryEntry, Name, "element">(priv);

function root(): Hash<Name> {
  if (root.root) return root.root;
  let mh = notError(makeHash(`Name`, App.Agent.Hash));
  if (!mh) {
    debug(`root: can't commit root`)
    throw new Error(`not even ready to commit root!`);
  }
  return root.root = notError(commit(`Name`, App.Agent.Hash));
}
namespace root {
  export var root: Hash<Name>;
}
const userLinks = new LinkRepo<Name, Name, string>("Links");

class Bad extends Error {
  get name() { return '' };
};

interface ErrStatus {
  msg: string;
}

interface OkStatus {
  msg: "ok";
}

type Status = ErrStatus|OkStatus;

function error(e: Error, note?: string) {
  return new Bad(`${note && `${note}:`} ${e.name && `(${e.name})`} ${e.message}`);
}

function hashByName(name: Name): Hash<Name> {
  return notError(makeHash("Name", name));
}

function getRepoEntry(name:Name): EntryInfo<RepoEntry> {

  let hash: Hash<RepoEntry>;
  let entry: RepoEntry;
  let nhash: Hash<Name>;
  let set: LinkSet<Name,UserEntry,string>;

  try { nhash = hashByName(name); }
  catch (e) { return { name, error: error(e, `getting name hash`) } };

  try { set = repos.get(nhash, `repo`); }
  catch(e) { return { name, error: error(e, `querying for repo @${name}`) } };

  try { hash = set.hashes()[0]; }
  catch (e) { return { name, error: error(e, `retrieving hash of repo @${name}`) } };

  try { entry = set.data()[0]; }
  catch (e) { return {name, hash, error: error(e, `retrieving repo @${name}`) } };

  return {name, hash, entry};
}

function getQuery(name: Name): {name: Name, hash: Hash<QueryEntry>, entry: QueryEntry} {

  const nhash = hashByName(name);
  const got = queries.get(nhash, `query`);
  const hash = got.hashes()[0];
  const entry = got.data()[0];
  return {name, hash, entry};
}

// Zome public functions

function createObject({name}: {name: string}): Status {

  try {
    const hash = notError(commit("Name", name));
    scope.put(root(), hash, `scope`);
  } catch (e) {
    return {msg: `Unable to create object: ${e}`};
  }
  return {msg: "ok"};
}

function createRepo({name}: {name: Name}): Status {

  let nhash: Hash<Name>;
  try {
    nhash = notError(commit(`Name`, name));
    scope.put(root(), nhash, `scope`);
  } catch (e) {
    return {msg: `Can't create name ${name}: ${e}`};
  }

  const repo = new LinkRepo<Name, Name, string>(`Links`);
  repo.userName = name;

  let rhash: Hash<RepoEntry>;
  try {
    rhash = notError(commit(`Repo`, repo.serial()));
  } catch (e) {
    return {msg: `Created LinkRepo but couldn't commit: ${e}`};
  }

  repos.put(nhash, rhash, `repo`);

  return {msg: `ok`};
}

type Aspect = "links"|"rules"|"elements";

type Dump = { [k in Aspect]?: string[]; };

type DumpOpt = {
  tags?: string[];
  names?: string[];
  links?: boolean;
  rules?: boolean;
  elements?: boolean;
};

function dumpIsEmpty(d: Dump) {
  for (let asp of <Aspect[]>["links", "rules", "elements"]) {
    if (d[asp] && d[asp].length === 0) return false;
  }
  return true;
}

function dump(opt: DumpOpt): { [k in Name]: Dump } & Status {
  if (!(opt.links || opt.rules || opt.elements)) {
    opt.links = opt.rules = opt.elements = true;
  } else {
    opt.links = opt.links || false;
    opt.rules = opt.rules || false;
    opt.elements = opt.elements || false;
  }
  const dict: { [k in Name]: Dump } = {};
  try {
    let everything = scope.get(root(), `scope`);
    if (opt.names && opt.names.length) {
      let names = new Set(opt.names);
      everything = everything.select(({entry}) => {
        return names.has(entry);
      });
    }
    everything = everything;
    const len = everything.length;
    const hashes = everything.hashes();
    const names = everything.data();


    let i = len;
    while (i--) {
      const name = names[i];
      const hash = hashes[i];
      const info = <Dump>{};

      if (opt.links !== false) {
        let links = userLinks.get(hash);
        try {
          let internals = links.tags(`repo`, `query`, `element`);
          links = links.notIn(internals);
        } catch (e) {

        }
        if (opt.tags) links = links.tags(...opt.tags);

        if (links.length) info.links = links.map(({Hash, Tag}) => {
          return `${Tag} ${get(Hash)}`;
        });
      }

      if (opt.rules !== false) {
        let maybe = repos.get(hash, `repo`);
        if (maybe.length) {
          let repo = LinkRepo.revive(maybe.data()[0]);
          info.rules = repo.rules();
        }
      }
      /* Not working yet
      if (opt.elements !== false) {
        let maybe = queries.get(hash, `query`);
        if (maybe.length) {
          let q = maybe.data()[0];
          info.elements = q.array.map(({Hash, Tag}) => {
            return `
              ${q.origin}:
              ${notError(get(q.baseHash))}
              ${Tag}
              ${notError(get(Hash))}
            `
          });
        }
      }
      */
      dict[name] = info;
    }
  } catch (e) {
    let msg = {msg: `Error during data dump: ${e}`};
    return Object.assign(dict, msg);
  }
  return Object.assign(dict, {msg: `ok`});
}

function createQuery({name, repo, base, tag}): Status & {elements?: Name[]} {
  let nameHash: Hash<Name>;
  if (name) {
    try {
      nameHash = notError(commit(`Name`, name));
    } catch (e) {
      return {msg: `Couldn't create name ${name}: ${e}`};
    }
  }

  let baseHash: Hash<Name>
  try {
    baseHash = hashByName(base);
  } catch (e) {
    return {msg: `Could find base object ${base}`};
  }

  let revived: UserRepo;
  try {
    revived = LinkRepo.revive(
      repos.get(hashByName(repo), `repo`).data()[0]
    );
  } catch (e) {
    return {msg: `Failed to revive LinkRepo @${repo}: ${e}`}
  }

  let ls = revived.get(baseHash, tag);
  let entry = ls.serial();
  let list = ls.data();

  let hash: Hash<QueryEntry>;
  try {
    hash = notError(commit(`Query`, list));
  } catch (e) {
    return {elements: list, msg: `Created and ran query, but couldn't store result in DHT: ${e}`}
  }
  if (name) queries.put(nameHash, hash, `query`);

  return {elements: list, msg: `ok`};
}

function link(args: {repo?: Name, base: Name, target: Name, tag: string}): Status & {link?: string} {
  let base: Hash<Name>;

  try {
    base = hashByName(args.base);
  } catch (e) {
    return {msg: `invalid link base Name ${args.base}: ${e}`};
  }

  let target: Hash<Name>;
  try {
    target = hashByName(args.target);
  } catch (e) {
    return {msg: `invalid link target Name ${args.target}: ${e}`};
  }

  const tag = args.tag;
  let repo: UserRepo;
  if (!args.repo) {
    repo = userLinks; //new LinkRepo<Name,Name,string>(`Links`);
  } else try {
    repo = LinkRepo.revive(getRepoEntry(args.repo).entry);
  } catch (e) {
    return {msg: `failed to load Repo @${args.repo}: ${e}`};
  }
  repo.put(base, target, tag);

  return {
    msg: `ok`,
    link: `${args.base} +${tag} ${args.target}`
  };
}

function removeObject(args: {name: Name}): Status {
  const name = args.name;
  let hash: Hash<Name>;
  try {
    hash = hashByName(name);
  } catch (e) {
    return {msg: `Failed to find object: ${e}`};
  }
  scope.remove(root(), hash, `scope`);
  return {msg: `ok`};
}

function removeLink(args: {repo?: Name, base: Name, target: Name, tag: string}): Status & {link?: string} {
  let repoHash: Hash<Name>;
  if (args.repo) {
    try {
      repoHash = hashByName(args.repo);
    } catch (e) {
      return {msg: `Failed to find repo name ${args.repo}: ${e}`};
    }
  }

  let base: Hash<Name>
  try {
    base = hashByName(args.base);
  } catch (e) {
    return {msg: `Failed to find subject ${args.base}: ${e}`};
  }

  let target: Hash<Name>;
  try {
    target = hashByName(args.target);
  } catch (e) {
    return {msg: `Failed to find object ${args.target}`};
  }

  const {tag} = args;

  let repo: UserRepo;
  if (args.repo) {
    try {
      repo = LinkRepo.revive(repos.get(repoHash, `repo`).data()[0]);
    } catch (e) {
      return {msg: `Failed to load and revive repo @${args.repo}: ${e}`};
    }
  } else {
    repo = new LinkRepo(`Links`);
  }
  repo.remove(base, target, tag);

  return {link: `${args.repo} -${args.tag} ${args.target}`, msg: `ok`};
}

function tags( args: {query: Name, tags: string[], dest?: Name} ): Status & {elements?: string[]} {

  let q: LinkSet<Name,Name,string,Name>;
  try {
    q = LinkSet.revive(queries.get(hashByName(args.query), `query`).data()[0]);
  } catch (e) {
    return {msg: `Failed to revive LinkSet @${args.query}: ${e}`};
  }

  const {tags} = args;
  let {dest} = args;
  //if (!dest) dest = args.query;

  const p = q.tags(...tags);

  if (!dest) {
    return {msg: `ok`, elements: p.data()};
  }

  let ph: Hash<QueryEntry>;
  try {
    ph = notError(commit(`QueryEntry`, p.serial()));
  } catch (e) {
    return {elements: p.data(), msg: `Failed to save the result LinkSet on the DHT: ${e}`};
  }

  let dh: Hash<Name>
  try {
    let dhe = get(hashByName(dest));
    if (isErr(dhe)) {
      dh = <Hash<Name>>commit(`Name`, dest);
    } else {
      dh = hashByName(dest);
    }
  } catch (e) {
    return {elements: p.data(), msg: `Failed to obtain object ${dest}: ${e}`};
  }

  queries.get(dh, `query`).removeAll();
  queries.put(dh, ph, `query`);

  return {elements: p.data(), msg: `ok`};
}

function hashes(args: {name: Name}): Status & {hashes?: Hash<Name>[]} {
  let q: EntryInfo<QueryEntry>;
  try {
    q = getQuery(args.name);
  } catch (e) {
    return {msg: `Failed to load query @${args.name}: ${e}`};
  }
  try {
    return {hashes: LinkSet.revive(q.entry).hashes(), msg: `ok`};
  } catch (e) {
    return {msg: `Failed to revive LinkSet @${args.name}: ${e}`};
  }
}

function data(args: {name: Name}): Status & {data?: Name[]} {
  let q: EntryInfo<QueryEntry>;
  try {
    q = getQuery(args.name);
  } catch (e) {
    return {msg: `Failed to load query @${args.name}: ${e}`};
  }
  try {
    return {data: LinkSet.revive(q.entry).data(), msg: `ok`};
  } catch (e) {
    return {msg: `Failed to revive LinkSet @${args.name}: ${e}`};
  }
}

function removeAllQuery(args: {name: Name}): {msg: string} {
  let {name} = args;
  let q = getQuery(name);
  LinkSet.revive(q.entry).removeAll();

  removeObject({name});

  return { msg: "ok" };
}

function reciprocal(args: {local: Tagish<Name,Name,string>, foreign?: Tagish<Name,Name,string>}): {msg: string} {
  let {local, foreign} = args;
  if (!foreign) {
    foreign = local;
  } else if (!foreign.repo) {
    foreign.repo = local.repo;
  }

  let nearRepo: UserRepo, farRepo: UserRepo;
  let nearHash: Hash<RepoEntry>;

  if (local.repo === foreign.repo) {
    const info = getRepoEntry(local.repo);
    if (info.error) {
      return {msg: `loading repo information @${local.repo}: ${info.error}`};
    }
    nearHash = info.hash;
    nearRepo = farRepo = LinkRepo.revive(info.entry);
  } else {
    const map = new Map<Name, UserRepo>();

    const nearInfo = getRepoEntry(local.repo);
    if (nearInfo.error) {
      return {msg: `loading repo information @${local.repo}: ${nearInfo.error}`};
    }
    nearHash = nearInfo.hash;
    nearRepo = LinkRepo.revive(nearInfo.entry, map);

    const farInfo = getRepoEntry(foreign.repo);
    if (farInfo.error) {
      return {msg: `loading repo information @${foreign.repo}: ${farInfo.error}`};
    }
    farRepo = LinkRepo.revive(farInfo.entry, map);
  }

  nearRepo.linkBack(local.tag, foreign.tag, farRepo);

  try {
    updateRepo(nearHash, nearRepo);
  } catch (e) {
    return {msg: `added rule, but could not update DHT: ${e}`};
  }

  return {msg: `ok`};
}

type PredObj<T> = {
  [k in "trigger"|"query"|"dependent"]: T;
}

function predicate(args: PredObj<Tagish>): {msg: string} {
  let tags: PredObj<string>;
  {
    let t = {};
    for (let arg of Object.keys(args)) {
      t[arg] = args[arg].tag;
    }
    tags = <PredObj<string>>t;
  }
  let entries: PredObj<RepoEntry> = {
    trigger: null, query: null, dependent: null
  };
  let infos: PredObj<EntryInfo<RepoEntry>> = {
    trigger: null, query: null, dependent: null
  };
  let repos: PredObj<UserRepo> = {
    trigger: null, query: null, dependent: null
  };
  let hashes: PredObj<Hash<UserEntry>> = {
    trigger: null, query: null, dependent: null
  };

  const keys = Object.keys(entries);
  const cache = new Map<Name, UserRepo>();

  for (let k of keys) {
    let info: EntryInfo<RepoEntry> = getRepoEntry(args[k].repo);
    if (info.error) {
      return {
        msg: `loading repo information of ${k} @${args[k].repo}: ${info.error}`
      };
    }
    infos[k] = info;
    entries[k] = info.entry;
    hashes[k] = info.hash;

    let repo: UserRepo;
    try {
      repo = LinkRepo.revive(info.entry, cache);
    } catch (e) {
      return {msg: `reconstructing ${k} repo @${args[k].repo}: ${e}`};
    }
    repos[k] = repo;
  }

  try {
    repos.trigger.predicate(
      tags.trigger,
      {tag: tags.query, repo: repos.query},
      {tag: tags.dependent, repo: repos.dependent}
    );
  } catch (e) {
    return {msg: `failed to create predicate rule: ${e}`};
  }

  let hash = hashes.trigger;
  try {
    updateRepo(hash, repos.trigger);
  } catch (e) {
    return {msg: `created rule, but couldn't save in DHT: ${e}`};
  }

  return {msg: `ok`};
}

function singular(args: Tagish): Status {
  const info: EntryInfo<RepoEntry> = getRepoEntry(args.repo);
  if (info.error) {
    return {msg: `failed to find information of repo @${args.repo}: ${info.error}`};
  }

  let repo: UserRepo;
  try {
    repo = LinkRepo.revive(info.entry);
    repo.singular(args.tag);
  } catch (e) {
    return {msg: `failed to load and create singular rule in repo @${args.repo}: ${e}`};
  }

  try {
    updateRepo(info.hash, repo);
  } catch (e) {
    return {msg: `created singular rule in repo @${args.repo} but couldn't save in DHT: ${e}`};
  }

  return {msg: `ok`};
}

function genesis() {
  root();
  return true;
}

function validateCommit(entryType, entry, header, pkg, sources) {
  // check against schema: YAGNI
  return true;
}

function validatePut(entryType, entry, header, pkg, sources) {
  // check for data sanity: YAGNI
  return validateCommit(entryType, entry, header, pkg, sources);
}

function validateMod(entryType, entry, header, replaces, pkg, sources) {
  // messages are immutable for now.
  return true;
}

function validateDel(entryType, hash, pkg, sources) {
  // messages are permanent for now
  return true;
}

function validateLink(entryType, hash, links, pkg, sources) {
  return true;
}

function validatePutPkg(entryType) {
  // don't care.
  return null;
}

function validateModPkg(entryType) {
  // can't happen, don't care
  return null;
}

function validateDelPkg(entryType) {
  // can't happen, don't care
  return null;
}

function validateLinkPkg(entryType) {
  // can't happen, don't care
  return null;
}

function wtf(arg: object): Status {
  return {msg: `not implemented here`};
}
