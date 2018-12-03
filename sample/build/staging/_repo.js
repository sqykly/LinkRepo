"use strict";
/**
 * The original library goes here
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
// no. , "__esModule", { value: true });
// no. ("./holochain-proto");
//import "./es6";
// no. ("./shims");
// no. ("./ex-array-shim");
/**
 * Either throw the error or return the desired result.  The type parameter
 * should usually be inferred from the argument, which will have better warnings
 * downstream.
 */
function notError(maybeErr) {
    if (isErr(maybeErr)) {
        throw new Error("That was an error! " + ("" + maybeErr));
    }
    else {
        return maybeErr;
    }
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
var LinkSet = /** @class */ (function (_super) {
    __extends(LinkSet, _super);
    /**
     * Don't new this.
     */
    function LinkSet(array, origin, baseHash, onlyTag, loaded) {
        if (loaded === void 0) { loaded = true; }
        var _this = _super.apply(this, __spread(array)) || this;
        _this.origin = origin;
        _this.baseHash = baseHash;
        _this.loaded = loaded;
        if (onlyTag) {
            _this.forEach(function (item) {
                item.Tag = onlyTag;
            });
        }
        return _this;
    }
    /**
     * Filter by any number of tags.  Returns a new LinkSet of the same type.
     * @param {string[]} narrowing An array of the tag names wanted.
     */
    LinkSet.prototype.tags = function () {
        var narrowing = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            narrowing[_i] = arguments[_i];
        }
        var uniques = new Set(narrowing);
        return new LinkSet(this.filter(function (_a) {
            var Tag = _a.Tag;
            return uniques.has(Tag);
        }), this.origin, this.baseHash);
    };
    /**
     * Filter by any number of entryTypes, which you should probably get from HoloObj.className
     * returns a new LinkSet.
     * if you like typesafety, use the type parameter to narrow the types, too.
     * @arg C Type or union of types that the result should contain.  These are classes, not names.
     * @params {string} typeNames is the list of types that the result should have.
     *  these are the type names, not the classes.
     * @returns {LinkSet<C>}
     */
    LinkSet.prototype.types = function () {
        var typeNames = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            typeNames[_i] = arguments[_i];
        }
        var uniques = new Set(typeNames);
        return new LinkSet(this.filter(function (_a) {
            var EntryType = _a.EntryType;
            return uniques.has(EntryType);
        }), this.origin, this.baseHash);
    };
    /**
     * Returns an array of Hashes from the LinkSet, typed appropriately
     */
    LinkSet.prototype.hashes = function () {
        return this.map(function (_a) {
            var Hash = _a.Hash;
            return Hash;
        });
    };
    /**
     * Returns the entries in the LinkSet as a typesafe array.
     */
    LinkSet.prototype.data = function () {
        return this.map(function (_a) {
            var Hash = _a.Hash;
            return notError(get(Hash));
        });
    };
    /**
     * Filters by source.
     * @param {holochain.Hash} ... allowed sources to be allowed
     */
    LinkSet.prototype.sources = function () {
        var allowed = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            allowed[_i] = arguments[_i];
        }
        var uniques = new Set(allowed);
        return new LinkSet(this.filter(function (_a) {
            var Source = _a.Source;
            return uniques.has(Source);
        }), this.origin, this.baseHash);
    };
    /**
     * All links in this set will be removed from the DHT.  Note that this is not
     * chainable, and the original object will be empty as well.
     */
    LinkSet.prototype.removeAll = function () {
        var _this = this;
        this.forEach(function (link, index) {
            var target = link.Hash, tag = link.Tag;
            try {
                _this.origin.remove(_this.baseHash, target, tag);
            }
            catch (e) {
                // don't care, just keep deleting them.
            }
        });
        var foo = this.splice(0, this.length);
    };
    /**
     * Filters and replaces elements of the set.  Provide a function that accepts
     * a LinkReplace ({hash, tag, type, entry}) and returns a LinkReplacement
     * ({hash, tag, type}).  Return undefined or the unmodified argument to leave
     * the link alone.  Return null to have the link deleted, both from the set
     * and the DHT.  Return false to remove the link from the set without deleting
     * on the DHT.  Otherwise, return the new {hash, tag, type}.
     * @returns {this}
     */
    LinkSet.prototype.replace = function (fn) {
        var e_1, _a;
        var _b = this, length = _b.length, origin = _b.origin;
        var removals = [];
        for (var i = 0; i < length; i++) {
            var type = this[i].EntryType;
            var hash = this[i].Hash;
            var tag = this[i].Tag;
            var entry = get(hash);
            if (!isErr(entry)) {
                var rep = fn({ hash: hash, tag: tag, type: type, entry: entry });
                if (rep === null) {
                    origin.remove(this.baseHash, hash, tag);
                    removals.push(i);
                }
                else if (rep === false) {
                    removals.push(i);
                }
                else if (rep && (tag !== rep.tag || hash !== rep.hash)) {
                    if (hash === rep.hash && type !== rep.type) {
                        throw new TypeError("can't link to " + type + " " + hash + " as type " + rep.type);
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
            }
            else {
                removals.push(i);
            }
        }
        try {
            for (var removals_1 = __values(removals), removals_1_1 = removals_1.next(); !removals_1_1.done; removals_1_1 = removals_1.next()) {
                var i = removals_1_1.value;
                this.splice(i, 1);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (removals_1_1 && !removals_1_1.done && (_a = removals_1.return)) _a.call(removals_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return this;
    };
    /**
     * Go through the set link by link, accepting or rejecting them for a new
     * LinkSet as you go.  The callback should accept a {type, entry, hash, tag}
     * and return a boolean.
     */
    LinkSet.prototype.select = function (fn) {
        var e_2, _a;
        var chosen = new LinkSet([], this.origin, this.baseHash);
        try {
            for (var _b = __values(this), _c = _b.next(); !_c.done; _c = _b.next()) {
                var response = _c.value;
                var type = response.EntryType, hash = response.Hash;
                var tag = response.Tag;
                var entry = notError(get(hash));
                if (fn({ type: type, entry: entry, hash: hash, tag: tag }))
                    chosen.push(response);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return chosen;
    };
    LinkSet.prototype.serial = function () {
        return {
            array: __spread(this),
            baseHash: this.baseHash,
            origin: this.origin.userName
        };
    };
    LinkSet.revive = function (qe) {
        return new LinkSet(qe.array, LinkRepo.revive(repos.get(hashByName(qe.origin), "repo").data()[0]), qe.baseHash);
    };
    return LinkSet;
}(ExArray));
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
var LinkRepo = /** @class */ (function () {
    /**
     * @param {string} name the exact dna.zomes[].Entries.Name that this repo will
     *  represent.
     */
    function LinkRepo(name) {
        this.name = name;
        this.backLinks = new Map();
        this.recurseGuard = new Map();
        this.selfLinks = new Map();
        this.predicates = new Map();
        this.exclusive = new Set();
    }
    LinkRepo.prototype.tag = function (t) {
        return { tag: t, repo: this };
    };
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
    LinkRepo.prototype.get = function (base, tag) {
        if (tag === void 0) { tag = ""; }
        var e_3, _a;
        var options = { Load: true };
        if (!tag) {
            return new LinkSet(notError(getLinks(base, tag, options)), this, base);
        }
        var tags = tag.split("|"), responses = [];
        try {
            for (var tags_1 = __values(tags), tags_1_1 = tags_1.next(); !tags_1_1.done; tags_1_1 = tags_1.next()) {
                tag = tags_1_1.value;
                var response = getLinks(base, tag, options);
                responses = responses.concat(response);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (tags_1_1 && !tags_1_1.done && (_a = tags_1.return)) _a.call(tags_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return new LinkSet(responses, this, base);
    };
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
    LinkRepo.prototype.put = function (base, link, tag, backRepo, backTag) {
        var e_4, _a, e_5, _b;
        var rg = this.recurseGuard;
        var rgv = rg.has(tag) ? rg.get(tag) : Infinity;
        if (!rgv--)
            return this;
        rg.set(tag, rgv);
        if (this.exclusive.has(tag)) {
            this.get(base, tag).removeAll();
        }
        if (this.predicates.has(tag)) {
            this.addPredicate(tag, base, link);
        }
        var hash = commit(this.name, { Links: [{ Base: base, Link: link, Tag: tag, LinkAction: HC.LinkAction.Add }] });
        if (this.backLinks.has(tag)) {
            try {
                for (var _c = __values(this.backLinks.get(tag)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var backLink = _d.value;
                    var repo = backLink.repo, revTag = backLink.tag;
                    repo.put(link, base, revTag);
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_4) throw e_4.error; }
            }
        }
        if (this.selfLinks.has(tag)) {
            try {
                for (var _e = __values(this.selfLinks.get(tag)), _f = _e.next(); !_f.done; _f = _e.next()) {
                    var revTag = _f.value;
                    this.put(link, base, revTag);
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                }
                finally { if (e_5) throw e_5.error; }
            }
        }
        if (backRepo && backTag) {
            backRepo.put(link, base, backTag);
        }
        rg.set(tag, ++rgv);
        return this;
    };
    /**
     * Adds a reciprocal to a tag that, when put(), will trigger an additional
     * put() from the linked object from the base object.
     * @param {T} tag the tag that will trigger the reciprocal to be put().
     * @param {LinkRepo<L,B,string>} repo The repo that will contain the reciprocal.
     * @param {string} backTag the tag that will be used for the reciprocal link.
     * @returns {ThisType}
     */
    LinkRepo.prototype.linkBack = function (tag, backTag, repo) {
        if (backTag === void 0) { backTag = tag; }
        backTag = backTag || tag;
        if (!repo || repo === this) {
            return this.internalLinkback(tag, backTag);
        }
        var entry = { repo: repo, tag: backTag };
        if (this.backLinks.has(tag)) {
            var existing = this.backLinks.get(tag);
            existing.push(entry);
        }
        else {
            this.backLinks.set(tag, [entry]);
        }
        this.recurseGuard.set(tag, 1);
        return this;
    };
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
    LinkRepo.prototype.predicate = function (triggerTag, query, dependent) {
        var predicates = this.predicates;
        if (!query.repo)
            query.repo = this;
        if (!dependent.repo)
            dependent.repo = this;
        if (predicates.has(triggerTag)) {
            predicates.get(triggerTag).push({ query: query, dependent: dependent });
        }
        else {
            predicates.set(triggerTag, [{ query: query, dependent: dependent }]);
        }
        return this;
    };
    /**
     * NOT WELL TESTED
     * When adding a link with the given tag, this repo will first remove any links
     * with the same tag.  This is for one-to-one and one end of a one-to-many.
     */
    LinkRepo.prototype.singular = function (tag) {
        this.exclusive.add(tag);
        return this;
    };
    LinkRepo.prototype.addPredicate = function (trigger, subj, obj) {
        var e_6, _a, e_7, _b;
        var triggered = this.predicates.get(trigger);
        try {
            for (var triggered_1 = __values(triggered), triggered_1_1 = triggered_1.next(); !triggered_1_1.done; triggered_1_1 = triggered_1.next()) {
                var _c = triggered_1_1.value, query_1 = _c.query, dependent = _c.dependent;
                var queried = query_1.repo.get(obj, query_1.tag).hashes();
                try {
                    for (var queried_1 = __values(queried), queried_1_1 = queried_1.next(); !queried_1_1.done; queried_1_1 = queried_1.next()) {
                        var q = queried_1_1.value;
                        dependent.repo.put(q, subj, dependent.tag);
                    }
                }
                catch (e_7_1) { e_7 = { error: e_7_1 }; }
                finally {
                    try {
                        if (queried_1_1 && !queried_1_1.done && (_b = queried_1.return)) _b.call(queried_1);
                    }
                    finally { if (e_7) throw e_7.error; }
                }
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (triggered_1_1 && !triggered_1_1.done && (_a = triggered_1.return)) _a.call(triggered_1);
            }
            finally { if (e_6) throw e_6.error; }
        }
    };
    LinkRepo.prototype.removePredicate = function (trigger, subj, obj) {
        var e_8, _a, e_9, _b;
        var triggered = this.predicates.get(trigger);
        try {
            for (var triggered_2 = __values(triggered), triggered_2_1 = triggered_2.next(); !triggered_2_1.done; triggered_2_1 = triggered_2.next()) {
                var _c = triggered_2_1.value, query_2 = _c.query, dependent = _c.dependent;
                var queried = query_2.repo.get(obj, query_2.tag).hashes();
                try {
                    for (var queried_2 = __values(queried), queried_2_1 = queried_2.next(); !queried_2_1.done; queried_2_1 = queried_2.next()) {
                        var q = queried_2_1.value;
                        dependent.repo.remove(q, subj, dependent.tag);
                    }
                }
                catch (e_9_1) { e_9 = { error: e_9_1 }; }
                finally {
                    try {
                        if (queried_2_1 && !queried_2_1.done && (_b = queried_2.return)) _b.call(queried_2);
                    }
                    finally { if (e_9) throw e_9.error; }
                }
            }
        }
        catch (e_8_1) { e_8 = { error: e_8_1 }; }
        finally {
            try {
                if (triggered_2_1 && !triggered_2_1.done && (_a = triggered_2.return)) _a.call(triggered_2);
            }
            finally { if (e_8) throw e_8.error; }
        }
    };
    LinkRepo.prototype.internalLinkback = function (fwd, back) {
        var mutual = fwd === back;
        if (this.selfLinks.has(fwd)) {
            this.selfLinks.get(fwd).push(back);
        }
        else {
            this.selfLinks.set(fwd, [back]);
        }
        if (mutual) {
            this.recurseGuard.set(fwd, 2);
        }
        else {
            this.recurseGuard.set(fwd, 1).set(back, 1);
        }
        return this;
    };
    LinkRepo.prototype.toLinks = function (base, link, tag) {
        return { Links: [{ Base: base, Link: link, Tag: tag }] };
    };
    LinkRepo.prototype.unLinks = function (links) {
        var _a = links.Links[0], Base = _a.Base, Link = _a.Link, Tag = _a.Tag;
        return { Base: Base, Link: Link, Tag: Tag };
    };
    /**
     * Gets the hash that a link would have if it existed.  Good to know if you use
     * update() and remove()
     * @param {Hash<B>} base the subject of the hypothetical link.
     * @param {Hash<L>} link the object of the hypothetical link.
     * @param {T} tag the tag of the hypothetical link.
     * @returns {LinkHash} if the list does or will exist, this is the hash it
     *  would have.
     */
    LinkRepo.prototype.getHash = function (base, link, tag) {
        return notError(makeHash(this.name, this.toLinks(base, link, tag)));
    };
    // FIXME this looks pretty gnarly
    /**
     * Remove the link with the specified base, link, and tag.  Reciprocal links
     * entered by linkBack() will also be removed.
     * @param {Hash<B>} base the base of the link to remove.
     * @param {Hash<L>} link the base of the link to remove.
     * @param {T} tag the tag of the link to remove
     * @returns {LinkHash} but not really useful.  Expect to change.
     */
    LinkRepo.prototype.remove = function (base, link, tag) {
        var e_10, _a, e_11, _b;
        var presentLink = this.toLinks(base, link, tag);
        var hash = notError(makeHash(this.name, presentLink));
        var rg = this.recurseGuard;
        var rgv = rg.get(tag);
        if (!rgv--) {
            return this;
        }
        if (get(hash) === HC.HashNotFound)
            return this;
        presentLink.Links[0].LinkAction = HC.LinkAction.Del;
        hash = notError(commit(this.name, presentLink));
        rg.set(tag, rgv);
        if (this.backLinks.has(tag)) {
            try {
                for (var _c = __values(this.backLinks.get(tag)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var _e = _d.value, repo = _e.repo, backTag = _e.tag;
                    repo.remove(link, base, backTag);
                }
            }
            catch (e_10_1) { e_10 = { error: e_10_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_10) throw e_10.error; }
            }
        }
        if (this.selfLinks.has(tag)) {
            try {
                for (var _f = __values(this.selfLinks.get(tag)), _g = _f.next(); !_g.done; _g = _f.next()) {
                    var back = _g.value;
                    this.remove(link, base, back);
                }
            }
            catch (e_11_1) { e_11 = { error: e_11_1 }; }
            finally {
                try {
                    if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
                }
                finally { if (e_11) throw e_11.error; }
            }
        }
        if (this.predicates.has(tag)) {
            this.removePredicate(tag, base, link);
        }
        rg.set(tag, ++rgv);
        return this;
    };
    /**
     * If the old link exists, remove it and replace it with the new link.  If
     * the old link doesn't exist, put() the new one.  As always, reciprocal links
     * are managed with no additional work.  Note that both arguments are the
     * holochain.Links type, complete with CamelCaseNames.
     * @param {holochain.Link} old The link to be replaced.
     * @param {holochain.Link} update The link to replace it with.
     * @returns {LinkHash} A hash that you can't use for much.  Expect to change.
     */
    LinkRepo.prototype.replace = function (old, update) {
        var oldHash = this.getHash(old.Base, old.Link, old.Tag);
        if (get(oldHash) === HC.HashNotFound) {
            return this.put(update.Base, update.Link, update.Tag);
        }
        this.remove(old.Base, old.Link, old.Tag);
        return this.put(update.Base, update.Link, update.Tag);
    };
    LinkRepo.prototype.serial = function () {
        var _this = this;
        var back = {};
        var exc = [];
        var pred = {};
        this.backLinks.forEach(function (blList, tag) {
            back[tag] = blList.map(function (bl) {
                return {
                    tag: bl.tag,
                    repo: bl.repo.userName
                };
            });
        });
        this.selfLinks.forEach(function (tagList, tag) {
            var list = back[tag];
            var tags = tagList.map((function (bt) { return ({ tag: bt, repo: _this.userName }); }));
            if (list) {
                back[tag] = list.concat(tags);
            }
            else {
                back[tag] = tags;
            }
        });
        this.exclusive.forEach(function (tag) {
            exc.push(tag);
        });
        this.predicates.forEach(function (predList, tag) {
            pred[tag] = predList.map(function (_a) {
                var q = _a.query, d = _a.dependent;
                var query = { tag: q.tag, repo: q.repo.userName };
                var dependent = { tag: d.tag, repo: d.repo.userName };
                return { query: query, dependent: dependent };
            });
        });
        return {
            name: this.userName,
            backLinks: back,
            exclusive: exc,
            predicates: pred
        };
    };
    LinkRepo.revive = function (re, guard) {
        if (guard === void 0) { guard = new Map(); }
        var e_12, _a, e_13, _b, e_14, _c, e_15, _d, e_16, _e;
        var repo = new LinkRepo("Links");
        repo.userName = re.name;
        guard.set(re.name, repo);
        function reviveTag(t) {
            if (guard.has(t.repo)) {
                return { tag: t.tag, repo: guard.get(t.repo) };
            }
            else {
                var tag = t.tag;
                var ls = repos.get(hashByName(t.repo), "repo");
                var entry = ls.data()[0];
                var repo_1 = LinkRepo.revive(entry);
                return { tag: tag, repo: repo_1 };
            }
        }
        try {
            for (var _f = __values(Object.keys(re.backLinks)), _g = _f.next(); !_g.done; _g = _f.next()) {
                var key = _g.value;
                try {
                    for (var _h = __values(re.backLinks[key]), _j = _h.next(); !_j.done; _j = _h.next()) {
                        var t = _j.value;
                        var _k = reviveTag(t), tag = _k.tag, targ = _k.repo;
                        repo.linkBack(key, tag, targ);
                    }
                }
                catch (e_13_1) { e_13 = { error: e_13_1 }; }
                finally {
                    try {
                        if (_j && !_j.done && (_b = _h.return)) _b.call(_h);
                    }
                    finally { if (e_13) throw e_13.error; }
                }
            }
        }
        catch (e_12_1) { e_12 = { error: e_12_1 }; }
        finally {
            try {
                if (_g && !_g.done && (_a = _f.return)) _a.call(_f);
            }
            finally { if (e_12) throw e_12.error; }
        }
        try {
            for (var _l = __values(re.exclusive), _m = _l.next(); !_m.done; _m = _l.next()) {
                var tag = _m.value;
                repo.singular(tag);
            }
        }
        catch (e_14_1) { e_14 = { error: e_14_1 }; }
        finally {
            try {
                if (_m && !_m.done && (_c = _l.return)) _c.call(_l);
            }
            finally { if (e_14) throw e_14.error; }
        }
        try {
            for (var _o = __values(Object.keys(re.predicates)), _p = _o.next(); !_p.done; _p = _o.next()) {
                var key = _p.value;
                try {
                    for (var _q = __values(re.predicates[key]), _r = _q.next(); !_r.done; _r = _q.next()) {
                        var pred = _r.value;
                        var q = pred.query, d = pred.dependent;
                        var query_3 = reviveTag(q);
                        var dependent = reviveTag(d);
                        repo.predicate(key, query_3, dependent);
                    }
                }
                catch (e_16_1) { e_16 = { error: e_16_1 }; }
                finally {
                    try {
                        if (_r && !_r.done && (_e = _q.return)) _e.call(_q);
                    }
                    finally { if (e_16) throw e_16.error; }
                }
            }
        }
        catch (e_15_1) { e_15 = { error: e_15_1 }; }
        finally {
            try {
                if (_p && !_p.done && (_d = _o.return)) _d.call(_o);
            }
            finally { if (e_15) throw e_15.error; }
        }
        return repo;
    };
    // FIXME - a dump only seems to want to show the 1 rule, but applies them all
    // just fine.
    LinkRepo.prototype.rules = function (a, b, c) {
        var _this = this;
        if (a === void 0) { a = "subject"; }
        if (b === void 0) { b = "object"; }
        if (c === void 0) { c = "other"; }
        var e_17, _a, e_18, _b, e_19, _c, e_20, _d, e_21, _e, e_22, _f, e_23, _g;
        var _h = this, backLinks = _h.backLinks, selfLinks = _h.selfLinks, exclusive = _h.exclusive, predicates = _h.predicates;
        var rules = [];
        var name = function (n) { return n.italics(); };
        var foreign = function (n) { return n.bold(); };
        var tagNear = function (n, home) {
            if (home === void 0) { home = _this; }
            if (home.exclusive.has(n))
                n = n + "!";
            if (home !== _this)
                n = foreign(home.userName) + ":" + n;
            return n.fixed();
        };
        var tagFar = function (n, home) {
            if (home === void 0) { home = _this; }
            return ("\n        " + (home.exclusive.has(n) ? '!' : '') + "\n        " + n + "\n        " + (home !== _this ? ":" + foreign(home.userName) : '') + "\n       ").fixed();
        };
        try {
            for (var _j = __values(backLinks.entries()), _k = _j.next(); !_k.done; _k = _j.next()) {
                var _l = __read(_k.value, 2), trigger = _l[0], bls = _l[1];
                try {
                    for (var bls_1 = __values(bls), bls_1_1 = bls_1.next(); !bls_1_1.done; bls_1_1 = bls_1.next()) {
                        var _m = bls_1_1.value, tag = _m.tag, repo = _m.repo;
                        rules.push("\n           All " + name(a) + " " + tagNear(trigger) + " " + name(b) + "\n           =>\n           " + name(b) + " " + tagFar(tag, repo) + " " + name(a) + "\n         ");
                    }
                }
                catch (e_18_1) { e_18 = { error: e_18_1 }; }
                finally {
                    try {
                        if (bls_1_1 && !bls_1_1.done && (_b = bls_1.return)) _b.call(bls_1);
                    }
                    finally { if (e_18) throw e_18.error; }
                }
            }
        }
        catch (e_17_1) { e_17 = { error: e_17_1 }; }
        finally {
            try {
                if (_k && !_k.done && (_a = _j.return)) _a.call(_j);
            }
            finally { if (e_17) throw e_17.error; }
        }
        try {
            for (var _o = __values(selfLinks.entries()), _p = _o.next(); !_p.done; _p = _o.next()) {
                var _q = __read(_p.value, 2), trigger = _q[0], links = _q[1];
                try {
                    for (var links_1 = __values(links), links_1_1 = links_1.next(); !links_1_1.done; links_1_1 = links_1.next()) {
                        var tag = links_1_1.value;
                        rules.push("\n           All " + name(a) + " " + tagNear(trigger, this) + " " + name(b) + "\n           => " + name(b) + " " + tagFar(tag, this) + " " + name(a) + "\n         ");
                    }
                }
                catch (e_20_1) { e_20 = { error: e_20_1 }; }
                finally {
                    try {
                        if (links_1_1 && !links_1_1.done && (_d = links_1.return)) _d.call(links_1);
                    }
                    finally { if (e_20) throw e_20.error; }
                }
            }
        }
        catch (e_19_1) { e_19 = { error: e_19_1 }; }
        finally {
            try {
                if (_p && !_p.done && (_c = _o.return)) _c.call(_o);
            }
            finally { if (e_19) throw e_19.error; }
        }
        try {
            for (var _r = __values(predicates.entries()), _s = _r.next(); !_s.done; _s = _r.next()) {
                var _t = __read(_s.value, 2), trigger = _t[0], plist = _t[1];
                try {
                    for (var plist_1 = __values(plist), plist_1_1 = plist_1.next(); !plist_1_1.done; plist_1_1 = plist_1.next()) {
                        var _u = plist_1_1.value, query_4 = _u.query, dependent = _u.dependent;
                        rules.push("\n           If " + name(a) + " " + tagNear(trigger) + " " + name(b) + "\n           => All " + name(c) + "\n           where " + name(b) + " " + tagNear(query_4.tag, query_4.repo) + " " + name(c) + ",\n           => " + name(c) + " " + tagFar(dependent.tag, dependent.repo) + " " + name(a) + "\n         ");
                    }
                }
                catch (e_22_1) { e_22 = { error: e_22_1 }; }
                finally {
                    try {
                        if (plist_1_1 && !plist_1_1.done && (_f = plist_1.return)) _f.call(plist_1);
                    }
                    finally { if (e_22) throw e_22.error; }
                }
            }
        }
        catch (e_21_1) { e_21 = { error: e_21_1 }; }
        finally {
            try {
                if (_s && !_s.done && (_e = _r.return)) _e.call(_r);
            }
            finally { if (e_21) throw e_21.error; }
        }
        try {
            for (var _v = __values(exclusive.values()), _w = _v.next(); !_w.done; _w = _v.next()) {
                var singular_1 = _w.value;
                rules.push("\n         Any " + name(a) + " " + tagNear(singular_1) + " " + name(b) + "\n         =>\n         No " + name(a) + " " + tagNear(singular_1) + " " + name(c) + "\n       ");
            }
        }
        catch (e_23_1) { e_23 = { error: e_23_1 }; }
        finally {
            try {
                if (_w && !_w.done && (_g = _v.return)) _g.call(_v);
            }
            finally { if (e_23) throw e_23.error; }
        }
        return rules;
    };
    return LinkRepo;
}());
// no. LinkRepo = LinkRepo;
var priv = "InteriorLinks";
var scope = new LinkRepo(priv);
var repos = new LinkRepo(priv);
var queries = new LinkRepo(priv);
function root() {
    if (root.root)
        return root.root;
    var mh = notError(makeHash("Name", App.Agent.Hash));
    if (!mh) {
        debug("root: can't commit root");
        throw new Error("not even ready to commit root!");
    }
    return root.root = notError(commit("Name", App.Agent.Hash));
}
(function (root_1) {
})(root || (root = {}));
var userLinks = new LinkRepo("Links");
var Bad = /** @class */ (function (_super) {
    __extends(Bad, _super);
    function Bad() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(Bad.prototype, "name", {
        get: function () { return ''; },
        enumerable: true,
        configurable: true
    });
    ;
    return Bad;
}(Error));
;
function error(e, note) {
    return new Bad((note && note + ":") + " " + (e.name && "(" + e.name + ")") + " " + e.message);
}
function hashByName(name) {
    return notError(makeHash("Name", name));
}
function getRepoEntry(name) {
    var hash;
    var entry;
    var nhash;
    var set;
    try {
        nhash = hashByName(name);
    }
    catch (e) {
        return { name: name, error: error(e, "getting name hash") };
    }
    ;
    try {
        set = repos.get(nhash, "repo");
    }
    catch (e) {
        return { name: name, error: error(e, "querying for repo @" + name) };
    }
    ;
    try {
        hash = set.hashes()[0];
    }
    catch (e) {
        return { name: name, error: error(e, "retrieving hash of repo @" + name) };
    }
    ;
    try {
        entry = set.data()[0];
    }
    catch (e) {
        return { name: name, hash: hash, error: error(e, "retrieving repo @" + name) };
    }
    ;
    return { name: name, hash: hash, entry: entry };
}
function getQuery(name) {
    var nhash = hashByName(name);
    var got = queries.get(nhash, "query");
    var hash = got.hashes()[0];
    var entry = got.data()[0];
    return { name: name, hash: hash, entry: entry };
}
// Zome public functions
function createObject(_a) {
    var name = _a.name;
    try {
        var hash = notError(commit("Name", name));
        scope.put(root(), hash, "scope");
    }
    catch (e) {
        return { msg: "Unable to create object: " + e };
    }
    return { msg: "ok" };
}
function createRepo(_a) {
    var name = _a.name;
    var nhash;
    try {
        nhash = notError(commit("Name", name));
        scope.put(root(), nhash, "scope");
    }
    catch (e) {
        return { msg: "Can't create name " + name + ": " + e };
    }
    var repo = new LinkRepo("Links");
    repo.userName = name;
    var rhash;
    try {
        rhash = notError(commit("Repo", repo.serial()));
    }
    catch (e) {
        return { msg: "Created LinkRepo but couldn't commit: " + e };
    }
    repos.put(nhash, rhash, "repo");
    return { msg: "ok" };
}
function dumpIsEmpty(d) {
    var e_24, _a;
    try {
        for (var _b = __values(["links", "rules", "elements"]), _c = _b.next(); !_c.done; _c = _b.next()) {
            var asp = _c.value;
            if (d[asp] && d[asp].length === 0)
                return false;
        }
    }
    catch (e_24_1) { e_24 = { error: e_24_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_24) throw e_24.error; }
    }
    return true;
}
function dump(opt) {
    var dict = {};
    try {
        var everything = scope.get(root(), "scope");
        if (opt.names && opt.names.length) {
            var names_1 = new Set(opt.names);
            everything = everything.select(function (_a) {
                var entry = _a.entry;
                return names_1.has(entry);
            });
        }
        everything = everything;
        var len = everything.length;
        var hashes_1 = everything.hashes();
        var names = everything.data();
        var i = len;
        var _loop_1 = function () {
            var name = names[i];
            var hash = hashes_1[i];
            var info = {};
            if (opt.links !== false) {
                var links = userLinks.get(hash);
                if (opt.tags)
                    links = links.tags.apply(links, __spread(opt.tags));
                if (links.length)
                    info.links = links.map(function (_a) {
                        var Hash = _a.Hash, Tag = _a.Tag;
                        return Tag + " " + get(Hash);
                    });
            }
            if (opt.rules !== false) {
                var maybe = repos.get(hash, "repo");
                if (maybe.length) {
                    var repo = LinkRepo.revive(maybe.data()[0]);
                    info.rules = repo.rules();
                }
            }
            if (opt.elements !== false) {
                var maybe = queries.get(hash, "query");
                if (maybe.length) {
                    var q_1 = maybe.data()[0];
                    info.elements = q_1.array.map(function (_a) {
                        var Hash = _a.Hash, Tag = _a.Tag;
                        return "\n              " + q_1.origin + ":\n              " + notError(get(q_1.baseHash)) + "\n              " + Tag + "\n              " + notError(get(Hash)) + "\n            ";
                    });
                }
            }
            dict[name] = info;
        };
        while (i--) {
            _loop_1();
        }
    }
    catch (e) {
        var msg = { msg: "Error during data dump: " + e };
        return Object.assign(dict, msg);
    }
    return Object.assign(dict, { msg: "ok" });
}
function createQuery(_a) {
    var name = _a.name, repo = _a.repo, base = _a.base, tag = _a.tag;
    var nameHash;
    if (name) {
        try {
            nameHash = notError(commit("Name", name));
        }
        catch (e) {
            return { msg: "Couldn't create name " + name + ": " + e };
        }
    }
    var baseHash;
    try {
        baseHash = hashByName(base);
    }
    catch (e) {
        return { msg: "Could find base object " + base };
    }
    var revived;
    try {
        revived = LinkRepo.revive(repos.get(hashByName(repo), "repo").data()[0]);
    }
    catch (e) {
        return { msg: "Failed to revive LinkRepo @" + repo + ": " + e };
    }
    var ls = revived.get(baseHash, tag);
    var entry = ls.serial();
    var list = ls.data();
    var hash;
    try {
        hash = notError(commit("Query", list));
    }
    catch (e) {
        return { elements: list, msg: "Created and ran query, but couldn't store result in DHT: " + e };
    }
    if (name)
        queries.put(nameHash, hash, "query");
    return { elements: list, msg: "ok" };
}
function link(args) {
    var base;
    try {
        base = hashByName(args.base);
    }
    catch (e) {
        return { msg: "invalid link base Name " + args.base + ": " + e };
    }
    var target;
    try {
        target = hashByName(args.target);
    }
    catch (e) {
        return { msg: "invalid link target Name " + args.target + ": " + e };
    }
    var tag = args.tag;
    var repo;
    if (!args.repo) {
        repo = userLinks; //new LinkRepo<Name,Name,string>(`Links`);
    }
    else
        try {
            repo = LinkRepo.revive(getRepoEntry(args.repo).entry);
        }
        catch (e) {
            return { msg: "failed to load Repo @" + args.repo + ": " + e };
        }
    repo.put(base, target, tag);
    return {
        msg: "ok",
        link: args.base + " +" + tag + " " + args.target
    };
}
function removeObject(args) {
    var name = args.name;
    var hash;
    try {
        hash = hashByName(name);
    }
    catch (e) {
        return { msg: "Failed to find object: " + e };
    }
    scope.remove(root(), hash, "scope");
    return { msg: "ok" };
}
function removeLink(args) {
    var repoHash;
    if (args.repo) {
        try {
            repoHash = hashByName(args.repo);
        }
        catch (e) {
            return { msg: "Failed to find repo name " + args.repo + ": " + e };
        }
    }
    var base;
    try {
        base = hashByName(args.base);
    }
    catch (e) {
        return { msg: "Failed to find subject " + args.base + ": " + e };
    }
    var target;
    try {
        target = hashByName(args.target);
    }
    catch (e) {
        return { msg: "Failed to find object " + args.target };
    }
    var tag = args.tag;
    var repo;
    if (args.repo) {
        try {
            repo = LinkRepo.revive(repos.get(repoHash, "repo").data()[0]);
        }
        catch (e) {
            return { msg: "Failed to load and revive repo @" + args.repo + ": " + e };
        }
    }
    else {
        repo = new LinkRepo("Links");
    }
    repo.remove(base, target, tag);
    return { link: args.repo + " -" + args.tag + " " + args.target, msg: "ok" };
}
function tags(args) {
    var q;
    try {
        q = LinkSet.revive(queries.get(hashByName(args.query), "query").data()[0]);
    }
    catch (e) {
        return { msg: "Failed to revive LinkSet @" + args.query + ": " + e };
    }
    var tags = args.tags;
    var dest = args.dest;
    //if (!dest) dest = args.query;
    var p = q.tags.apply(q, __spread(tags));
    if (!dest) {
        return { msg: "ok", elements: p.data() };
    }
    var ph;
    try {
        ph = notError(commit("QueryEntry", p.serial()));
    }
    catch (e) {
        return { elements: p.data(), msg: "Failed to save the result LinkSet on the DHT: " + e };
    }
    var dh;
    try {
        var dhe = get(hashByName(dest));
        if (isErr(dhe)) {
            dh = commit("Name", dest);
        }
        else {
            dh = hashByName(dest);
        }
    }
    catch (e) {
        return { elements: p.data(), msg: "Failed to obtain object " + dest + ": " + e };
    }
    queries.get(dh, "query").removeAll();
    queries.put(dh, ph, "query");
    return { elements: p.data(), msg: "ok" };
}
function hashes(args) {
    var q;
    try {
        q = getQuery(args.name);
    }
    catch (e) {
        return { msg: "Failed to load query @" + args.name + ": " + e };
    }
    try {
        return { hashes: LinkSet.revive(q.entry).hashes(), msg: "ok" };
    }
    catch (e) {
        return { msg: "Failed to revive LinkSet @" + args.name + ": " + e };
    }
}
function data(args) {
    var q;
    try {
        q = getQuery(args.name);
    }
    catch (e) {
        return { msg: "Failed to load query @" + args.name + ": " + e };
    }
    try {
        return { data: LinkSet.revive(q.entry).data(), msg: "ok" };
    }
    catch (e) {
        return { msg: "Failed to revive LinkSet @" + args.name + ": " + e };
    }
}
function removeAllQuery(args) {
    var name = args.name;
    var q = getQuery(name);
    LinkSet.revive(q.entry).removeAll();
    removeObject({ name: name });
    return { msg: "ok" };
}
function reciprocal(args) {
    var local = args.local, foreign = args.foreign;
    if (!foreign) {
        foreign = local;
    }
    else if (!foreign.repo) {
        foreign.repo = local.repo;
    }
    var nearRepo, farRepo;
    var nearHash;
    if (local.repo === foreign.repo) {
        var info = getRepoEntry(local.repo);
        if (info.error) {
            return { msg: "loading repo information @" + local.repo + ": " + info.error };
        }
        nearHash = info.hash;
        nearRepo = farRepo = LinkRepo.revive(info.entry);
    }
    else {
        var map = new Map();
        var nearInfo = getRepoEntry(local.repo);
        if (nearInfo.error) {
            return { msg: "loading repo information @" + local.repo + ": " + nearInfo.error };
        }
        nearRepo = LinkRepo.revive(nearInfo.entry, map);
        var farInfo = getRepoEntry(foreign.repo);
        if (farInfo.error) {
            return { msg: "loading repo information @" + foreign.repo + ": " + farInfo.error };
        }
        farRepo = LinkRepo.revive(farInfo.entry, map);
    }
    nearRepo.linkBack(local.tag, foreign.tag, farRepo);
    try {
        update("Repo", nearRepo.serial(), nearHash);
    }
    catch (e) {
        return { msg: "added rule, but could not update DHT: " + e };
    }
    return { msg: "ok" };
}
function predicate(args) {
    var e_25, _a, e_26, _b;
    var tags;
    {
        var t = {};
        try {
            for (var _c = __values(Object.keys(args)), _d = _c.next(); !_d.done; _d = _c.next()) {
                var arg = _d.value;
                t[arg] = args[arg].tag;
            }
        }
        catch (e_25_1) { e_25 = { error: e_25_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_25) throw e_25.error; }
        }
        tags = t;
    }
    var entries = {
        trigger: null, query: null, dependent: null
    };
    var infos = {
        trigger: null, query: null, dependent: null
    };
    var repos = {
        trigger: null, query: null, dependent: null
    };
    var hashes = {
        trigger: null, query: null, dependent: null
    };
    var keys = Object.keys(entries);
    var cache = new Map();
    try {
        for (var keys_1 = __values(keys), keys_1_1 = keys_1.next(); !keys_1_1.done; keys_1_1 = keys_1.next()) {
            var k = keys_1_1.value;
            var info = getRepoEntry(args[k].repo);
            if (info.error) {
                return {
                    msg: "loading repo information of " + k + " @" + args[k].repo + ": " + info.error
                };
            }
            infos[k] = info;
            entries[k] = info.entry;
            hashes[k] = info.hash;
            var repo = void 0;
            try {
                repo = LinkRepo.revive(info.entry, cache);
            }
            catch (e) {
                return { msg: "reconstructing " + k + " repo @" + args[k].repo + ": " + e };
            }
            repos[k] = repo;
        }
    }
    catch (e_26_1) { e_26 = { error: e_26_1 }; }
    finally {
        try {
            if (keys_1_1 && !keys_1_1.done && (_b = keys_1.return)) _b.call(keys_1);
        }
        finally { if (e_26) throw e_26.error; }
    }
    try {
        repos.trigger.predicate(tags.trigger, { tag: tags.query, repo: repos.query }, { tag: tags.dependent, repo: repos.dependent });
    }
    catch (e) {
        return { msg: "failed to create predicate rule: " + e };
    }
    var hash = hashes.trigger;
    try {
        update("Repo", repos.trigger.serial(), hash);
    }
    catch (e) {
        return { msg: "created rule, but couldn't save in DHT: " + e };
    }
    return { msg: "ok" };
}
function singular(args) {
    var info = getRepoEntry(args.repo);
    if (info.error) {
        return { msg: "failed to find information of repo @" + args.repo + ": " + info.error };
    }
    var repo;
    try {
        repo = LinkRepo.revive(info.entry);
        repo.singular(args.tag);
    }
    catch (e) {
        return { msg: "failed to load and create singular rule in repo @" + args.repo + ": " + e };
    }
    try {
        update("Repo", repo.serial(), info.hash);
    }
    catch (e) {
        return { msg: "created singular rule in repo @" + args.repo + " but couldn't save in DHT: " + e };
    }
    return { msg: "ok" };
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
