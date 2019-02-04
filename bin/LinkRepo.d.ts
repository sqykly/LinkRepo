import "./holochain-proto";

declare type Iterable<T extends string|number> = T[];

declare class Set<T extends string|number> {
  size: number;
  constructor(items?: Iterable<T>);
  add(item: T): this;
  has(item: T): boolean;
  delete(item: T): this;
  keys(): T[];
  values(): T[];
  forEach(cb: (t:T) => void, thisVal?: object): void;
  clear();
  union(other: Set<T>): Set<T>;
  intersect(other: Set<T>): Set<T>;
  disjunct(other: Set<T>): Set<T>;
}

declare class Map<K, T> {
  size: number;
  constructor(items?: [K, T][]);
  set(key: K, item: T): this;
  has(key: K): boolean;
  get(key: K): T;
  delete(key: K): this;
  keys(): K[];
  values(): T[];
  entries(): [K, T][];
  forEach(cb: (t:T, k:K) => void, thisVal?: object): void;
}

declare interface String {
  bold(): string;
  fixed(): string;
  italics(): string;
}

declare interface ObjectConstructor {
  assign<T,U>(t: T, u: U): T&U;
}


declare class ExArray<T> extends Array<T> {}

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
declare function notError<T>(maybeErr: holochain.CanError<T>): T;

declare interface LinkReplacement<T, Tags> {
  hash: Hash<T>;
  tag: Tags;
  type: string;
}

declare interface LinkReplace<T, Tags> extends LinkReplacement<T, Tags> {
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
declare class LinkSet<B, L, Tags extends string = string, T extends L = L> extends ExArray<holochain.GetLinksResponse> {
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
   * This is the type you expect to get from the entry field.
   */
  readonly TYPE: T;

  private origin: LinkRepo<B,L,Tags>;
  private baseHash: Hash<T>;
  private loaded: boolean;
  /**
   * If true, the LinkSet will keep its repo in sync with itself.  While false, no
   * operation on this set or its descendents will modify the links on the DHT,
   * including remove, add, and replace, until the save() method is called.
   * True by default.
   * @see LinkSet.save
   */
  public sync: boolean;
  /**
   * Don't new this.
   */
  constructor(array: Array<holochain.GetLinksResponse>, origin: LinkRepo<B,L,Tags>, baseHash: string, onlyTag?: string, loaded?: boolean);
  /**
   * Filter by any number of tags.  Returns a new LinkSet of the same type.
   * @param {string[]} narrowing An array of the tag names wanted.
   */
  tags<Tt extends T>(...narrowing: string[]): LinkSet<B, L, Tags, Tt>;

  /**
   * Filter by any number of entryTypes, which you should probably get from HoloObj.className
   * returns a new LinkSet.
   * if you like typesafety, use the type parameter to narrow the types, too.
   * @arg {class} C Type or union of types that the result should contain.  These are classes, not names.
   * @params {string} typeNames is the list of types that the result should have.
   *  these are the type names, not the classes.
   * @returns {LinkSet}
   */
  types<C extends T = T>(...typeNames: string[]): LinkSet<B,L,Tags,C>;

  /**
   * Returns an array of Hashes from the LinkSet, typed appropriately
   * @returns {Array} The hashes in the set
   */
  hashes(): Hash<T>[];

  /**
   * Returns the entries in the LinkSet as a typesafe array.
   * @returns {T[]} The entries of the links in the set.
   */
  data(): T[];

  /**
   * Filters by source.
   * @param {holochain.Hash} ... allowed sources to be allowed
   * @returns {LinkSet}
   */
  sources(...allowed: holochain.Hash[]): LinkSet<B,L,Tags,T>;

  /**
   * All links in this set will be removed from the DHT.  Note that this is not
   * chainable, and the original object will be empty as well.
   */
  removeAll(): void;

  /**
   * Filters and replaces elements of the set.
   * @param {Function(LinkReplace<T, Tags>) => LinkReplacement<T,Tags>|false} fn -
   *  takes an object {hash, tag, type, entry} and returns an object
   *  {hash, tag, type} that will replace it.  It can also return undefined
   *  to leave the link alone, null to have the link removed AND deleted on the
   *  DHT, or false to remove the link from the result set without altering the
   *  DHT.
   * @returns {this} A new LinkSet
   */
  replace(fn: (obj: LinkReplace<T, Tags>) => LinkReplacement<T, Tags>|false): this;

  /**
   * Go through the set link by link, accepting or rejecting them for a new
   * LinkSet as you go.  The callback should accept a {type, entry, hash, tag}
   * and return a boolean.
   */
  select(fn: (lr: LinkReplace<T, Tags>) => boolean): LinkSet<B, L, Tags, T>;

  private descEntry(args: {Hash: Hash<B>, Tag?: string, EntryType?: string}): string;

  private desc(): string[];

  /**
   * Returns a new LinkSet with the elements of this that are not also in the
   * given argument.  Useful when you need to negate a filter.
   * @param {LinkSet} ls the set with which the result will be disjoint.
   * @returns {LinkSet}
   */
  notIn<Bn extends B, Ln extends L, TagsN extends Tags, Tn extends Ln>
  (ls: LinkSet<Bn,Ln,TagsN,Tn>): LinkSet<B,L,Tags,T>;

  /**
   * Returns a new LinkSet with the elements this set and another have in common.
   * Useful when you need to run several independent filters.
   * @param {LinkSet} ls the set to filter over.
   * @returns {LinkSet}
   */
  andIn<La extends L, TagsA extends string, Ta extends La>
  (ls: LinkSet<B,La,TagsA,Ta>): LinkSet<B, L, Tags, T>;

  /**
   * Pushes a new link into the set and adds it in its repo, if sync is enabled.
   * @param {Tags} tag The tag for the link to be added.
   * @param {Hash} hash The target to link to
   * @param {string} type The type name of the target
   * @returns {ThisType} chainable
   */
  add(tag: Tags, hash: Hash<L>, type: string): this;

  /**
   * If this set is not synchronized with its repo, save any changes made to it
   * to the DHT.
   * @param {Boolean?} add If true, links missing from the DHT will be committed.
   *  defaults to true.
   * @param {Boolean?} rem If true, links missing from this set will be removed
   *  from the DHT.  Don't use unless the set is certain to hold every link you
   *  want with the same tags.  Default is false.
   * @returns {ThisType} chainable
   */
  save(add?: boolean, rem?: boolean): this;
}

declare interface Tag<B,L, T extends string> {
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
declare class LinkRepo<B, L, T extends string = string> {
  /**
   * @param {string} name the exact dna.zomes[].Entries.Name that this repo will
   *  represent.
   */
  constructor (name: string);
  name: string;

  protected backLinks: Map<T, Tag<L|B,B|L, T|string>[]>;
  /*
  protected recurseGuard: Map<T, number>();
  /*/
  protected recurseGuard: Set<string>;
  protected guard(base: Hash<B>, link: Hash<L>, tag: T, op: '+'|'-', fn: () => void): void;
  /**/
  protected selfLinks: Map<T, T[]>;
  protected predicates: Map<
    T,
    { query: Tag<L|B, B|L, T|string>, dependent: Tag<L|B, B|L, T|string> }[]
  >;
  protected exclusive: Set<T>;
  readonly BASE: B;
  readonly LINK: L;
  readonly TAGS: T;

  tag<Ts extends T>(t: Ts): Tag<B, L, T>;
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
  get(base: Hash<B>, ...tags: T[]): LinkSet<B,L,T,L>;

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
  put(base: Hash<B>, link: Hash<L>, tag: T, backRepo?: LinkRepo<L, B>, backTag?: string): this;

  /**
   * Adds a reciprocal to a tag that, when put(), will trigger an additional
   * put() from the linked object from the base object.
   * @param {T} tag the tag that will trigger the reciprocal to be put().
   * @param {LinkRepo<L,B,string>} repo The repo that will contain the reciprocal.
   * @param {string} backTag the tag that will be used for the reciprocal link.
   * @returns {ThisType}
   */
  linkBack(tag: T, backTag?: T|string, repo?: LinkRepo<L|B, B|L, string>): this;

  // box example:
  // on A -insideOf B, for N: B contains N { N -nextTo A; A -nextTo N }
  // on A +insideOf B, for N: B contains N { N +nextTo A; A +nextTo N }
  /**
   * NOT WELL TESTED
   * Expresses a rule between 3 tags that ensures that any A triggerTag B,
   * for all C where B query.tag C, also C dependent.tag A
   * The reverse should also be true; if not A triggerTag B, any C where
   * B query.tag C, not C dependent.tag A
   * @param {T} triggerTag the tag local to this repo that will trigger
   *  maintenance of the predicate relationship
   * @param {Tag<L|B,B|L,T2|T>} query The repo and tag that determine which
   *  entries are subject to the predicate relationship.  The entries are the
   *  object of these links from the object of the trigger tag.
   * @param {Tag<L|B,B|L,T|T3>} dependent The repo and tag that are dependent
   *  on the trigger and query tag relationship.  The subject of the trigger tag
   *  will be linked/unlinked with this tag to the objects of the query tag.
   * @returns {ThisType} Chainable
   */
  predicate<T2 extends string = T, T3 extends string = T>(
    triggerTag: T,
    query: { tag: T2, repo: LinkRepo<L|B, B|L, T2|T> },
    dependent: { tag: T3, repo: LinkRepo<L|B, B|L, T3|T> }
  ): this;

  /**
   * When adding a link with the given tag, this repo will first remove any links
   * with the same tag from the same object.  This is for one-to-one and one end
   * of a one-to-many.
   * @param {T} tag the tag that is limited to one object per subject
   * @returns {ThisType} Chainable
   */
  singular(tag: T): this;

  private addPredicate(trigger: T, subj: Hash<B>, obj: Hash<L>);

  private removePredicate(trigger: T, subj: Hash<B>, obj: Hash<L>);

  private internalLinkback(fwd: T, back: T): this;

  private toLinks(base: Hash<B>, link: Hash<L>, tag: T): holochain.LinksEntry;

  private unLinks(links: holochain.LinksEntry): {Base: Hash<B>, Link: Hash<L>, Tag: T};

  /**
   * Gets the hash that a link would have if it existed.  Good to know if you use
   * update() and remove()
   * @param {Hash<B>} base the subject of the hypothetical link.
   * @param {Hash<L>} link the object of the hypothetical link.
   * @param {T} tag the tag of the hypothetical link.
   * @returns {LinkHash} if the list does or will exist, this is the hash it
   *  would have.
   */
  getHash(base: Hash<B>, link: Hash<L>, tag: T): LinkHash;

  // FIXME this looks pretty gnarly
  /**
   * Remove the link with the specified base, link, and tag.  Reciprocal links
   * entered by linkBack() and dependent links from predicate() will also be
   * removed.
   * @param {Hash<B>} base the base of the link to remove.
   * @param {Hash<L>} link the base of the link to remove.
   * @param {T} tag the tag of the link to remove
   * @returns {ThisType}
   */
  remove(base: Hash<B>, link: Hash<L>, tag: T): this;
  /**
   * If the old link exists, remove it and replace it with the new link.  If
   * the old link doesn't exist, put() the new one.  As always, reciprocal links
   * are managed with no additional work.  Note that both arguments are the
   * holochain.Links type, complete with CamelCaseNames.
   * @param {holochain.Link} old The link to be replaced.
   * @param {holochain.Link} update The link to replace it with.
   * @returns {LinkHash} A hash that you can't use for much.  Expect to change.
   */
  replace(old: holochain.Link, update: holochain.Link): this;
}
