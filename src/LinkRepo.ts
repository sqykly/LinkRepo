import "./holochain-proto";
import "./shims";
import "./ex-array-shim";

/**
 * This is for type safety when you need assurance that get(Hash) will return the correct type.
 * Not sure if it's working this way, but type safety for returns from get()
 * is still good.
 */
export declare type Hash<T> = holochain.Hash;

/**
 * The hash you get when commiting a holochain.LinksEntry
 */
export declare type LinkHash = Hash<holochain.LinksEntry>;

/**
 * Either throw the error or return the desired result.  The type parameter
 * should usually be inferred from the argument, which will have better warnings
 * downstream.
 */
export function notError<T>(maybeErr: holochain.CanError<T>): T {
  if (isErr(maybeErr)) {
    throw new Error(`That was an error! ${``+maybeErr}`);
  } else {
    return (<T> maybeErr);
  }
}

export interface LinkReplacement<T, Tags> {
  hash: Hash<T>;
  tag: Tags;
  type: string;
}

export interface LinkReplace<T, Tags> extends LinkReplacement<T, Tags> {
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
export class LinkSet<B, L, Tags extends string = string, T extends L = L> extends ExArray<holochain.GetLinksResponse> {
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

  sync: boolean = true;
  /**
   * Don't new this.
   */
  constructor(
    array: Array<holochain.GetLinksResponse>,
    private origin: LinkRepo<B,L,Tags>,
    private baseHash: string,
    onlyTag?: string,
    private loaded: boolean = true,
    sync: boolean = true
  ) {
    super(...array);
    this.sync = sync;
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
    //*
    if (this.sync) this.forEach( (link: holochain.GetLinksResponse, index:number) => {
      let target = link.Hash, tag = link.Tag;
      try {
        this.origin.remove(this.baseHash, target, <Tags>tag);
      } catch (e) {
        // don't care, just keep deleting them.
      }
    });
    this.splice(0, this.length);
    /*/// Why did I think this would work?
    if (this.sync) {
      commit(
        this.origin.name,
        {
          Links: this.map(link => ({
            Base: this.baseHash,
            Link: link.Hash,
            Tag: link.Tag,
            LinkAction: HC.LinkAction.Del
          }))
        }
      );
    } else {
      this.splice(0);
    }
    /**/
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
  replace(fn: (obj: LinkReplace<T, Tags>, i: number, me: this) => LinkReplacement<T, Tags>|false): this {
    const {length, origin} = this;
    const removals: number[] = [];

    for (let i = 0; i < length; i++) {
      const {EntryType: type} = this[i];
      let hash = <Hash<T>>this[i].Hash;
      let tag = <Tags>this[i].Tag;

      let entry = get(hash);

      if (!isErr(entry)) {
        let rep = fn({hash, tag, type, entry}, i, this);
        if (rep === null) {
          if (this.sync) origin.remove(this.baseHash, hash, tag);
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
    let chosen = new LinkSet<B, L, Tags, T>([], this.origin, this.baseHash, undefined, this.loaded, this.sync);

    for (let response of this) {
      let {EntryType: type, Hash: hash} = response;
      let tag = <Tags> response.Tag;
      let lr = {
        hash, tag, type,
        get entry() {
          return <T>notError(get(hash));
        }
      };
      if (fn(lr)) chosen.push(response);
    }

    return chosen;
  }

  unique(cleanDht: boolean = this.sync): LinkSet<B,L,Tags,T> {
    const inSet = new Set<string>();
    const result = new LinkSet<B,L,Tags,T>([], this.origin, this.baseHash, undefined, this.loaded, this.sync);

    for (let link of this) {
      const desc = this.descEntry(link);
      if (!inSet.has(desc)) {
        inSet.add(desc);
        result.push(link);
      } else if (cleanDht) {
        this.origin.remove(this.baseHash, link.Hash, <Tags> link.Tag);
      }
    }

    return result;
  }

  has(tag: Tags, hash: Hash<T>): boolean {
    let i = this.length;
    while (i--) {
      const link = this[i];
      if (link.Tag === tag && link.Hash === hash) return true;
    }

    return false;
  }

  private descEntry(args: {Hash: Hash<B>, Tag?: string, EntryType?: string}): string {
    const {Hash, Tag, EntryType} = args;
    return `${Tag || `no-tag`} ${Hash}:${EntryType || `no-type`}`;
  }

  private desc(): string[] {
    return this.map(this.descEntry);
  }

  /**
   * Return this LinkSet without the links that are present in another LinkSet.
   * Useful to negate the other filtering methods, e.g. foo.notIn(foo.tags(`not this tag`))
   * If the LinkSet is not from the same LinkRepo or isn't the same link base,
   * the returned object will have the same elements.
   * @param {LinkSet} ls The disjoint LinkSet
   * @returns {LinkSet} A LinkSet with all elements of this linkset except those
   *  in the provided disjoint LinkSet.
   */
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
      this.loaded,
      this.sync
    );
  }

  /**
   * Returns the links that are in both this linkset and another.  Useful if
   * you have two independent filtering operations.
   * @param {LinkSet} ls The intersecting LinkSet
   * @returns {LinkSet} LinkSet with elements in both this and ls
   */
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
      this.loaded,
      this.sync
    );
  }

  add(tag: Tags, hash: Hash<T>, type: string): this {
    if (this.sync) this.origin.put(this.baseHash, hash, tag);
    this.push({
      Hash: hash,
      Tag: tag,
      EntryType: type,
      Source: App.Agent.Hash
    });

    return this;
  }

  save(add: boolean = true, rem: boolean = false): this {
    if (this.sync) return this;
    let tags: Set<Tags> = new Set(this.map(({Tag}) => <Tags>Tag));
    for (let tag of tags.values()) {
      let existing = this.origin.get(this.baseHash, tag);

      if (add) for (let hash of this.notIn(existing).hashes()) {
        this.origin.put(this.baseHash, hash, tag);
      }

      if (rem) {
        existing.notIn(this).removeAll();
      }
    }
    return this;
  }
}

interface Tag<B,L, T extends string> {
  tag: T,
  repo: LinkRepo<B,L,T>
}

/**
 * Problems:
 *  The actual links entry type is not filtered in the response from getLinks.
 *  That kind of undermines the concept of it being a repository.
 *    Can't fake it with tags, since tag strings are types and are gone at runtime
 *
 *  FIXED: The recursion guard seems overzealous, stopping the application of a reciprocal
 *  tag unnecessarily.  Sometimes.  Maybe not the first time?
 *    Fixed by entering a full description of the event ("A +tag B") in the RG,
 *    doing away with the notion of how many times a tag can be repeated in the
 *    stack.
 *
 *  update() does not appear to work in the test system for load/store repos.
 *
 *  Remove() does not appear to be effective.  Of course removeAll() is broken
 *  too.
 *    Given that the test system assumes there is only one result for querying
 *    repos, it is possible that it is finding old versions by using the first
 *    of an array of all of its versions.  BUT it shouldn't be able to find
 *    an old version without asking for it specifically, right?
 *
 */

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
export class LinkRepo<B, L, T extends string = string> {
  /**
   * @param {string} name the exact dna.zomes[].Entries.Name that this repo will
   *  represent.
   */
  constructor (public readonly name: string) {}

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
   * @param {string} ...tags this is the tag or tags you want to filter by.  If
   *  omitted, all tags will be included - including those from other repos, so
   *  consider filtering the result by type or source afterward.
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
   * When adding a link with the given tag, this repo will first remove any links
   * with the same tag.  This is for one-to-one and one end of a one-to-many.
   * @param {T} tag The tag to become singular
   * @returns {this} Chainable.
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
    // Not going to happen.  makeHash doesn't work out for links.  Nor get.
    //let hash = notError<LinkHash>(makeHash(this.name, presentLink));
    // ADD THIS BACK ONCE THE TEST SYSTEM ISSUE IS WORKED OUT
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
      let hash = notError<LinkHash>(commit(this.name, presentLink));

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
}
