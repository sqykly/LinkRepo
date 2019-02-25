/*
 * Adaptation of holochain-proto-types that includes additional type safety.
 * Original Source: https://github.com/holochain/holochain-proto-types/blob/master/index.d.ts
 *
 * Added sections and replaced sections are tagged ADDED and REPLACED respectively.
 * Everything else is credited to the original source.
 *
 * In summary:
 *
 *  All functions documented as returning some type or an error are now declared
 *  to return a CanError<type>
 *
 *  All entry data is now declared as the type EntryData, which is a union of
 *  the types that entry data can actually be (vs. any).
 *  The DNA file determines which type it really is
 *  (unfortunately DNA is not accessible to TypeScript)
 *    - StringEntry where zomeEntryType.DataFormat == "string"
 *    - JsonEntry where zomeEntryType.DataFormat == "json".  There is more to
 *      know about these since the DNA must supply a schema for them, but the
 *      schema is also inaccessible.
 *    - LinksEntry where zomeEntryType.DataFormat == "links"
 *      LinksEntry is further structured; a linksEntry.Links is an array of Link
 *      as defined in the API documentation.
 *
 *  All enums supplied as properties of the HC global are declared as an opaque
 *  type, of which the only instances are those properties of the global.  That
 *  will ensure that only the appropriate values (whose actual type is undisclosed)
 *  are accepted rather than any old value.
 *
 *  All functions which take an options argument with defined fields now have a
 *  type for their options to provide type safety on the documented fields of
 *  those objects.
 *
 * todo (maybe): callbacks & types therein
 * todo (maybe): annotations.
 * todo: a micro-library to shorthand casts and type guards.
 */

// holochain ambient type defs for API

// ADDED: there is apparently an isError()
declare function isErr<T>(thing: holochain.CanError<T>): thing is holochain.HolochainError;

// REPLACED declare function property(name: string): string;
declare function property(name: string): holochain.CanError<string>;

// REPLACED declare function makeHash (entryType: string, entryData: any): holochain.Hash;
declare function makeHash(entryType: string, entryData: holochain.EntryData): holochain.CanError<holochain.Hash>;

declare function debug(value: any): void;

// REPLACED declare function call(zomeName: string, functionName: string, arguments: string | object): any;
declare function call(zomeName: string, functionName: string, arguments: holochain.Arguments): holochain.CanError<any>;

// REPLACED declare function bridge(appDNAHash: holochain.Hash, zomeName: string, functionName: string, arguments: string | object): any;
declare function bridge(appDNAHash: holochain.Hash, zomeName: string, functionName: string, arguments: holochain.Arguments): any;

declare function getBridges(): holochain.BridgeStatus[];

// REPLACED declare function sign(doc: string): string;
declare function sign(doc: string): holochain.CanError<string>;

// REPLACED declare function verifySignature(signature: string, data: string, pubKey: string): boolean;
declare function verifySignature(signature: holochain.Signature, data: string, pubKey: string): holochain.CanError<boolean>;

// REPLACED declare function commit(entryType: string, entryData: string | object): holochain.Hash;
declare function commit(entryType: string, entryData: holochain.EntryData): holochain.CanError<holochain.Hash>;

// REPLACED declare function get(hash: holochain.Hash, options?: object): holochain.GetResponse | any;
declare function get(hash: holochain.Hash, options?: holochain.GetOptions): holochain.GetResponse | holochain.EntryData | holochain.HashNotFound;

// REPLACED declare function getLinks(base: holochain.Hash, tag: string, options?: object): holochain.GetLinksResponse[];
// todo: options.Load determines exact return type; should be possible to infer.
declare function getLinks(base: holochain.Hash, tag?: string, options?: holochain.LinksOptions):
  holochain.CanError<holochain.GetLinksResponse[] | holochain.EntryData[]>;

// REPLACED declare function update(entryType: string, entryData: string | object, replaces: holochain.Hash): holochain.Hash;
declare function update(entryType: string, entryData: holochain.EntryData, replaces: holochain.Hash): holochain.CanError<holochain.Hash>;

// REPLACED declare function updateAgent(options: object): holochain.Hash;
declare function updateAgent(options: holochain.UpdateAgentOptions): holochain.CanError<holochain.Hash>;

declare function remove(entryHash: holochain.Hash, message: string): holochain.Hash;

// REPLACED declare function query(options?: object): holochain.QueryResponse[] | any[];
// todo: options.Return keys & values determine exact return type.  Should be possible to infer.
declare function query(options?: holochain.QueryOptions): holochain.CanError<holochain.QueryResult>;

// REPLACED declare function send(to: holochain.Hash, message: object, options?: object): any;
declare function send(to: holochain.Hash, message: object, options?: holochain.SendOptions): any;

declare function bundleStart(timeout: number, userParam: any): void;
declare function bundleClose(commit: boolean): void;

declare var HC: holochain.HolochainSystemGlobals;
declare var App: holochain.HolochainAppGlobals;


declare namespace holochain {
	type Hash = string;
	type Signature = string;
	type HolochainError = object;
	type PackageRequest = object;

  // ADDED single-instance types in the HC object
  type HashNotFound = any;

  // ADDED enum properties in the HC object
  // property of HC.LinkAction
  type LinkAction = any;
  // property of HC.Status; can be combined with + operator
  type StatusMaskValue = number;
  // property of HC.GetMask; can be combined with + operator
  type GetMaskValue = number;
  // property of HC.PkgReq
  // todo: can they be combined?
  type PkgReqValue = any;
  // property of HC.Bridge
  type BridgeSide = any;
  // property of HC.SysEntryType
  type SysEntry = any;
  // property of HC.BundleCancel.Reason
  type BundleCancelReason = any;
  // property of HC.BundleCancel.Response
  type BundleCancelResponse = any;

  // ADDED entries can be strings, "JSON" entries, or arrays of links wrapped in {Links:[]}
  type StringEntry = string;
  type JsonEntry = {[k:string]: string|number|boolean|undefined|null|JsonEntry};
  // a linksEntry.Links[] has properties we might as well know...
  interface Link {
    Base: Hash;
    Link: Hash;
    Tag: string;
    LinkAction?: LinkAction;
  }
  // link arrays are wrapped in an object
  interface LinksEntry {
    Links: Link[];
  }
  type EntryData = StringEntry | JsonEntry | LinksEntry;

  // ADDED a lot of the API functions can return errors, too.
  type CanError<T> = T | HolochainError;

  // ADDED but not sure I want it as it could force an inconvenient cast
  type Arguments = string | object;

  // ADDED an options interface for get() to ensure the proper enums are used.
  interface GetOptions {
    StatusMask?: StatusMaskValue;
    GetMask?: GetMaskValue;
    Local?: boolean;
    Bundle?: boolean;
  }

  // ADDED an options interface for getLinks()
  interface LinksOptions {
    Load?: boolean;
    StatusMask?: StatusMaskValue;
  }

  // ADDED an options interface for updateAgent()
  interface UpdateAgentOptions {
    Revocation: string;
    Identity: string;
  }

  // ADDED an options interface for query().  Might not be useful as the docs
  // are not clear on what is optional, what defaults are, etc.
  interface QueryOptions {
    Return?: {
      Entries?: boolean;
      Hashes?: boolean;
      Headers?: boolean;
    }
    Constrain?: {
      EntryTypes?: string[];
      Contains?: string;
      Equals?: string;
      Matches?: RegExp;
      Count?: number;
      Page?: number;
    }
    Order?: {
      Ascending?: boolean;
    }
    Bundle?: boolean;
  }

  // ADDED an options interface for send()
  interface SendOptions {
    Callback: {
      Function: string;
      ID: string;
    }
  }

	interface Header {
	  Type: string;
	  Time: string;
	  HeaderLink: Hash;
	  EntryLink: Hash;
	  TypeLink: Hash;
	  Sig: Signature;
	  Change: Hash;
	}

  interface GetResponse {

    // REPLACED Entry?: any;
    Entry?: EntryData;
	  EntryType?: string;
	  Sources?: Hash[];
	}

	interface GetLinksResponse {
	  Hash: Hash;

    // REPLACED Entry?: any;
    Entry?: EntryData;

	  EntryType?: string;
	  Tag?: string;
	  Source?: Hash;
	}

  interface QueryResponse {

    // REPLACED Hash?: string
    Hash?: Hash;

    // REPLACED Entry?: any
	  Entry?: EntryData;

	  Header?: Header
	}

  // ADDED the actual result of query() is an array of Hashes, Entries, Headers, or QueryResponse
  type QueryResult = Hash[] | EntryData[] | Header[] | QueryResponse[];

	interface BridgeStatus {
	  Side: number;
	  CalleeName?: string;
	  CalleeApp?: Hash;
	  Token?: string;
	}


	/*=====  End of Holochain Data Types  ======*/


	interface HolochainSystemGlobals {
	  Version: string;

    // REPLACED HashNotFound: any;
	  HashNotFound: HashNotFound;

    // REPLACED Status: any;
	  Status: {
      Live: StatusMaskValue;
      Deleted: StatusMaskValue;
      Rejected: StatusMaskValue;
      Any: StatusMaskValue;
    }

    // REPLACED GetMask: any;
	  GetMask: {
      Default: GetMaskValue;
      Entry: GetMaskValue;
      EntryType: GetMaskValue;
      Sources: GetMaskValue;
      All: GetMaskValue;
    }

    // REPLACED LinkAction: any;
	  LinkAction: {
      Add: LinkAction;
      Del: LinkAction;
    }

    // REPLACED PkgReq: any;
	  PkgReq: {
      Chain: PkgReqValue;
      ChainOpt: PkgReqValue;
      EntryTypes: PkgReqValue;
    }

    // REPLACED Bridge: any;
	  Bridge: {
      From: BridgeSide;
      To: BridgeSide;
    }

    // REPLACED SysEntryType: any;
	  SysEntryType: {
      DNA: SysEntry;
      Agent: SysEntry;
      Key: SysEntry;
      Headers: SysEntry;
      Del: SysEntry;
    }

    // REPLACED BundleCancel: any;
	  BundleCancel: {
      Reason: {
        User: BundleCancelReason;
        Timeout: BundleCancelReason;
      }
      Response: {
        Commit: BundleCancelResponse;
        OK: BundleCancelResponse;
      }
    }
	}

	interface HolochainAppGlobals {
	  Name: string;
	  DNA: {
	    Hash: Hash;
	  };
	  Key: {
	    Hash: Hash;
	  }
	  Agent: {
	    Hash: Hash;
	    TopHash: Hash;
	    String: string;
	  }
	}
}

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

declare function shimmy(): void;
declare class ExArray<T> extends Array<T> {}
// no "./holochain-proto";
// no "./shims";
// no "./ex-array-shim";
/**
 * This is for type safety when you need assurance that get(Hash) will return the correct type.
 * Not sure if it's working this way, but type safety for returns from get()
 * is still good.
 */
/*export*/ declare type Hash<T> = holochain.Hash;
/**
 * The hash you get when commiting a holochain.LinksEntry
 */
/*export*/ declare type LinkHash = Hash<holochain.LinksEntry>;
/**
 * Either throw the error or return the desired result.  The type parameter
 * should usually be inferred from the argument, which will have better warnings
 * downstream.
 */
/*export*/ declare function notError<T>(maybeErr: holochain.CanError<T>): T;
/*export*/ interface LinkReplacement<T, Tags> {
    hash: Hash<T>;
    tag: Tags;
    type: string;
}
/*export*/ interface LinkReplace<T, Tags> extends LinkReplacement<T, Tags> {
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
/*export*/ declare class LinkSet<B, L, Tags extends string = string, T extends L = L> extends ExArray<holochain.GetLinksResponse> {
    private origin;
    private baseHash;
    private loaded;
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
    sync: boolean;
    /**
     * Don't new this.
     * @param {holochain.GetLinksResponse[]} array the links that exist on the DHT
     * @param {LinkRepo} origin The repo creating this object
     * @param {Hash} baseHash The hash of the object that is the base of these links
     * @param {string} onlyTag Vestigial
     * @param {boolean} loaded Are the entries loaded? default true
     * @param {boolean} sync Do mutations to this object happen on the DHT?  default true
     * @constructor
     */
    constructor(array: Array<holochain.GetLinksResponse>, origin: LinkRepo<B, L, Tags>, baseHash: string, onlyTag?: string, loaded?: boolean, sync?: boolean);
    /**
     * Filter by any number of tags.  Returns a new LinkSet of the same type.
     * @param {string[]} narrowing An array of the tag names wanted.
     */
    tags<Tt extends T>(...narrowing: string[]): LinkSet<B, L, Tags, Tt>;
    /**
     * Filter by any number of entryTypes, which you should probably get from HoloObj.className
     * returns a new LinkSet.
     * if you like typesafety, use the type parameter to narrow the types, too.
     * @arg C Type or union of types that the result should contain.  These are classes, not names.
     * @params {string} typeNames is the list of types that the result should have.
     *  these are the type names, not the classes.
     * @returns {LinkSet<C>}
     */
    types<C extends T = T>(...typeNames: string[]): LinkSet<B, L, Tags, C>;
    /**
     * Returns an array of Hashes from the LinkSet, typed appropriately
     * @returns {Hash} Hash<T>[]
     */
    hashes(): Hash<T>[];
    /**
     * Returns the entries in the LinkSet as a typesafe array.
     */
    data(): T[];
    /**
     * Filters by source.
     * @param {Hash} allowed... sources to be allowed
     * @returns {LinkSet} LinkSet
     */
    sources(...allowed: holochain.Hash[]): LinkSet<B, L, Tags, T>;
    /**
     * All links in this set will be removed from the DHT.  Note that this is not
     * chainable, and the original object will be empty as well.
     */
    removeAll(): void;
    /**
     * Filters and replaces elements of the set.  Provide a function that accepts
     * a LinkReplace ({hash, tag, type, entry}) and returns a LinkReplacement
     * ({hash, tag, type}).  Return undefined or the unmodified argument to leave
     * the link alone.  Return null to have the link deleted, both from the set
     * and the DHT.  Return false to remove the link from the set without deleting
     * on the DHT.  Otherwise, return the new {hash, tag, type}.
     * @param {Function} fn ({hash, tag, type, entry}) => {hash, tag, type} | null | undefined | false
     * @returns {this} LinkSet
     */
    replace(fn: (obj: LinkReplace<T, Tags>, i: number, me: this) => LinkReplacement<T, Tags> | false): this;
    /**
     * Go through the set link by link, accepting or rejecting them for a new
     * LinkSet as you go.  The callback should accept a {type, entry, hash, tag}
     * and return a boolean.
     * @param fn  Callback function
     * @returns {LinkSet} LinkSet
     */
    select(fn: (lr: LinkReplace<T, Tags>) => boolean): LinkSet<B, L, Tags, T>;
    /**
     * Removes links with duplicate hashes and tags
     * @param {Boolean} cleanDht should the duplicates be removed from the DHT,
     *  too?  Defaults to the value of this.sync
     * @returns {LinkSet} LinkSet
     */
    unique(cleanDht?: boolean): LinkSet<B, L, Tags, T>;
    /**
     * Is this link in my LinkSet?
     * @param {Tags} tag The tag to search
     * @param {Hash} hash The hash to search
     * @returns {Boolean} Boolean
     */
    has(tag: Tags, hash: Hash<T>): boolean;
    private descEntry;
    private desc;
    /**
     * Return this LinkSet without the links that are present in another LinkSet.
     * Useful to negate the other filtering methods, e.g. foo.notIn(foo.tags(`not this tag`))
     * If the LinkSet is not from the same LinkRepo or isn't the same link base,
     * the returned object will have the same elements.
     * @param {LinkSet} ls The disjoint LinkSet
     * @returns {LinkSet} A LinkSet with all elements of this linkset except those
     *  in the provided disjoint LinkSet.
     */
    notIn<Bn extends B, Ln extends L, TagsN extends Tags, Tn extends Ln>(ls: LinkSet<Bn, Ln, TagsN, Tn>): LinkSet<B, L, Tags, T>;
    /**
     * Returns the links that are in both this linkset and another.  Useful if
     * you have two independent filtering operations.
     * @param {LinkSet} ls The intersecting LinkSet
     * @returns {LinkSet} LinkSet with elements in both this and ls
     */
    andIn<La extends L, TagsA extends string, Ta extends La>(ls: LinkSet<B, La, TagsA, Ta>): LinkSet<B, L, Tags, T>;
    /**
     * Add additional links to the set.  If this.sync, it will be added to the DHT too
     * @param {Tags} tag The tag of the link
     * @param {Hash} hash The hash of the object to be added with that tag
     * @param {String} type The type name of the entry
     * @returns {LinkSet} LinkSet
     */
    add(tag: Tags, hash: Hash<T>, type: string): this;
    /**
     * Pushes the current set to the DHT if it isn't synced already
     * @param {Boolean} add Should additional links be added to the DHT?  Default true
     * @param {Boolean} rem Should missing links be deleted from the DHT?  Default false
     * @returns {LinkSet} LinkSet for chaining
     */
    save(add?: boolean, rem?: boolean): this;
}
interface Tag<B, L, T extends string> {
    tag: T;
    repo: LinkRepo<B, L, T>;
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
/*export*/ declare class LinkRepo<B, L, T extends string = string> {
    readonly name: string;
    /**
     * @param {string} name the exact dna.zomes[].Entries.Name that this repo will
     *  represent.
     */
    constructor(name: string);
    protected backLinks: Map<T, Tag<B | L, B | L, string | T>[]>;
    protected recurseGuard: Set<string>;
    protected guard(base: Hash<B>, link: Hash<L>, tag: T, op: '+' | '-', fn: () => void): void;
    protected selfLinks: Map<T, T[]>;
    protected predicates: Map<T, {
        query: Tag<B | L, B | L, string | T>;
        dependent: Tag<B | L, B | L, string | T>;
    }[]>;
    protected exclusive: Set<T>;
    readonly BASE: B;
    readonly LINK: L;
    readonly TAGS: T;
    tag<Ts extends T>(t: Ts): Tag<B, L, T>;
    /**
     * Sets up an empty LinkSet that can interact with this repo.
     * @param {Hash} base Any added links will use this hash as the base
     * @returns {LinkSet} an empty LinkSet
     */
    emptySet(base: Hash<B>): LinkSet<B, L, T, L>;
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
    get(base: Hash<B>, ...tags: T[]): LinkSet<B, L, T, L>;
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
    linkBack(tag: T, backTag?: T | string, repo?: LinkRepo<L | B, B | L, string>): this;
    /**
     * Expresses a rule between 3 tags that ensures that any A triggerTag B,
     * all C where B query.tag C, also C dependent.tag A
     * The reverse should also be true; if not A triggerTag B, any C where
     * B query.tag C, not C dependent.tag A
     */
    predicate<T2 extends string = T, T3 extends string = T>(triggerTag: T, query: {
        tag: T2;
        repo: LinkRepo<L | B, B | L, T2 | T>;
    }, dependent: {
        tag: T3;
        repo: LinkRepo<L | B, B | L, T3 | T>;
    }): this;
    /**
     * When adding a link with the given tag, this repo will first remove any links
     * with the same tag.  This is for one-to-one and one end of a one-to-many.
     * @param {T} tag The tag to become singular
     * @returns {this} Chainable.
     */
    singular(tag: T): this;
    private addPredicate;
    private removePredicate;
    private internalLinkback;
    private toLinks;
    private unLinks;
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
    /**
     * Remove the link with the specified base, link, and tag.  Reciprocal links
     * entered by linkBack() will also be removed.
     * @param {Hash<B>} base the base of the link to remove.
     * @param {Hash<L>} link the base of the link to remove.
     * @param {T} tag the tag of the link to remove
     * @returns {LinkHash} but not really useful.  Expect to change.
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
// no;
