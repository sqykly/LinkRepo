// lib/es6 ensures I have access to all ES6 types and methods with typesafety.
import "lib/es6";
// holochain-proto here is my mockup of the holochain API.  I built it to do
// tests of modules in isolation without building the whole app.
import { register, makeHash } from "./holochain-proto";
// common is where LinkRepo and LinkSet are defined.  They need a holochain API,
// so in order to run just anywhere, I've provided the fake one.
import "./common";
import { LinkRepo, Hash, notError } from "./common";

/**
 * In this abstract Field, T is the type that is get()ed and given to set().
 * B, if specifed, is the type returned from set(), which I use to return the
 * object on which the field resides so that set()s can be chained.  Same thing
 * as when you use jQuery.  I'll show you after defining IPerson.
 */
abstract class Field<T, B = void> {
  abstract get(): T;
  abstract set(to: T): B;
}

/**
 * For an example, I'll be implementing this interface, IPerson, with all of its
 * fields emulated by LinkRepos.  For simplicity, there is no plain-old-data
 * apart from the name.
 */
interface IPerson {
  /**
   * A simple directed reference (foreign key) with no reciprocal.
   */
  favoriteDeadRelative: Field<IPerson, IPerson>;

  /**
   * A one to one reciprocal field.
   */
  marriedTo: Field<IPerson, IPerson>;

  /**
   * A one to N field with a complimentary reciprocal
   */
  favoriteCelebrity: Field<IPerson, IPerson>;
  adoredBy: Field<IPerson[], IPerson>;

  /**
   * An N to N field; call it reciprocal.
   */
  friends: Field<IPerson[], IPerson>;

  readonly name: string;
}

/** probably don't need to see this */
namespace howToChainCall {
  export function midlifeCrisis(person: IPerson) {
    // remember, these are not real people.
    const numberOfTrueFriends: number = Math.ceil(Math.random()*3) + 1,
      spouse: IPerson = person.marriedTo.get(),
      friends: IPerson[] = spouse.friends.get(),
      buddies: IPerson[] = person.friends.get(),
      trueFriends: IPerson[] = buddies.slice(0, numberOfTrueFriends),
      badFriends: IPerson[] = buddies.slice(numberOfTrueFriends),
      thePrettyFriend: IPerson = friends[0],
      thatActorWeBothLike: IPerson = spouse.favoriteCelebrity.get();

    /** how to chain like a boss */
    person
      .marriedTo.set(thePrettyFriend)
      .friends.set(trueFriends)
      .favoriteCelebrity.set(
        person.favoriteCelebrity.get() == thatActorWeBothLike
          ? person.favoriteDeadRelative.get()
          : person.favoriteCelebrity.get()
      );

    // two sides of every story
    if (spouse.marriedTo.get()) throw new Error(`linkBack didn't work`);

    spouse.friends.set([...friends.slice(1), ...badFriends]);

    // that karma though.
    thePrettyFriend.friends.set([]);
    spouse.marriedTo.set(thatActorWeBothLike);
  }
}

namespace implementation {
  /**
   * Some quick boilerplate to make TypeScript happy.
   */
  class Named {
    constructor(public readonly name:Name) {}
    private cachedHash: Hash<Person>;
    hash(): Hash<Person> {
      if (this.cachedHash) return this.cachedHash;
      return this.cachedHash = notError(makeHash(`PersonName`, this.name));
    }
    valueOf() {
      return this.name;
    }
  }
  type Name = string;
  /**
   * Throughout this namespace I'll be mixing into the Person class.
   */
  class Person implements IPerson {
	  friends: Field<IPerson[], Person>;
	  adoredBy: Field<IPerson[], Person>;
	  favoriteCelebrity: Field<IPerson, Person>;
	  marriedTo: Field<IPerson, Person>;
	  favoriteDeadRelative: Field<IPerson, Person>;

    private myName: Named;
    get name(): Name {
      return ``+this.myName;
    }
    get hash(): Hash<Person> {
      return this.myName.hash;
    }

    constructor(name: Name) {
      this.myName = new Named(name);
    }

    /**
     * In order to build this up piecewise, onConstruct lets us add code to the
     * constructor (functionally).
     */
    static onConstruct(fn: (this: Person) => void) {
      const ctor = this.constructor;
      this.constructor = function (name: Name) {
        ctor.call(this, name);
        fn.call(this);
      };
    }
  }

  // In a real holo-app, "entry types" are defined in a "dna" file.  The mock
  // API uses a register function instead.
  register({ TypeName: `PersonLinks`, DataFormat: `links` });

  // Just 1 actual entry type would be fine, but we do need an entry to link
  // FROM and an entry to link TO.  I choose a simple string that is the name
  // of the person.
  register({ TypeName: `PersonName`, DataFormat: `string` });

  namespace Person {
    /**
     * Set up a bare bones Field that gets and sets 1 link.  No funny business.
     */
    namespace deadRelative {
      const tag = new LinkRepo<Name, Name, "favoriteDeadRelative">(`PersonLinks`);

      Person.onConstruct(function () {
        this.favoriteDeadRelative = {
          /**
           * To fetch 1:
           *  get() to get a LinkSet of all links
           *  data() to get an array of entries
           *  [0] to pick one
           */
          get: () => {
            let name = tag.get(this.hash, `favoriteDeadRelative`).data()[0]
            return new Person(name);
          },
          /**
           * To enforce just one link:
           *  get() to get the LinkSet of all links
           *  removeAll() to break all present links
           */
          set: (to: IPerson) => {
            let name = to.name,
              hash = new Named(name).hash();
            tag.get(this.hash, `favoriteDeadRelative`).removeAll();
            tag.put(this.hash, hash, `favoriteDeadRelative`);
            return this;
          }
        };
      });

    }

    /**
     * Set up a managed one to one Field.  The difference is the call to linkBack().
     * Here, I want to maintain the symmetric pair of links (A->B and B->A)
     * so querying A-> will always result in B if and only if B-> will return
     * A.  linkBack() ensures that deleting C->D (where C is one of A
     * or B, D is A or B that isn't C, and X is some other object) will delete
     * D->C also, and assigning C->X will also assign X->C.
     * The symmetric tags used to be a weak point (an infinite recursion risk)
     * but it's fixed now.
     * The other behavior needed is breaking A->B and B->A when A-> is assigned
     * to X, but that's already demonstrated in the favoriteDeadRelative Field.
     * set() deletes the previous link, which will trigger the linkBack deletion
     * behavior.
     */
    namespace married {
      const tag = new LinkRepo<Name, Name, "marriedTo">(`PersonLinks`);

      tag.linkBack(`marriedTo`);

      Person.onConstruct(function () {
        this.marriedTo = {
          get: () => {
            return new Person(tag.get(this.hash, `marriedTo`).data()[0] || `his work`);
          },
          set: (to: IPerson) => {
            /**
             * The difference is entirely auto-magic.  The tag variable knows
             * it needs to divorce or marry BOTH parties, never just 1.
             */
            tag.get(this.hash, `marriedTo`).removeAll();
            // maybe they just want to be single for a while.
            if (!to) return this;

            tag.put(this.hash, new Person(to.name).hash, `marriedTo`);
            return this;
          }
        };
      });
    }

    /**
     * The one to many tag pair, favoriteCelebrity + adoredBy, is not much harder
     * than anything above.
     */
    namespace celebrities {
      /**
       * I'm using two tags here to demonstate that I can do that to keep them
       * straight at a type-safety level (if I get the tag wrong, it won't even
       * compile).  This also comes in handy when there are various classes in
       * the same links entry that link to/from each other.  See the bottom of
       * the namespace for an example of when it can make a difference
       */
      const favCelebrity = new LinkRepo<Name, Name, "favoriteCelebrity">(`PersonLinks`);
      const fans = new LinkRepo<Name, Name, "adoredBy">(`PersonLinks`);
      /**
       * ...But, I also want to make it clear that one repo with two tags will do.
       */
      const celebFans = new LinkRepo<Name, Name, "favoriteCelebrity"|"adoredBy">(`PersonLinks`);
      // won't bother with it  again though.

      /**
       * With two vars and two tags, I use all 3 arguments to linkBack()
       *  - near tag from its own repo (must be in the this repo, even if they are
       *    really in the same entry)
       *  - far tag to link back with mutual put/remove
       *  - foreign repo that has the far tag.
       * BOTH of the repos need to be instructed to link back, even if they are
       * technically the same entry.  Repos are not entries, links, or tags.
       * They are what's missing from those things.
       */
      favCelebrity.linkBack(`favoriteCelebrity`, `adoredBy`, fans);
      fans.linkBack(`adoredBy`, `favoriteCelebrity`, favCelebrity);

      Person.onConstruct(function () {
        /**
         * I would need to make two assignments no matter how I broke things up.
         */
        this.adoredBy = {
          get: () => {
            /**
             * Remember how, for one-to-one, it was necessary to do
             * LinkSet.data().map()[0]?  That's because link query results are
             * ALWAYS arrays like a Many scenario, and in the previous examples,
             * I needed to carefully fake the One aspect in the get()/set().
             * If I instead want all results, great, just don't fake it.
             */
            return fans.get(this.hash, `adoredBy`).data().map(name => new Person(name));
          },
          set: (people: IPerson[]) => {
            fans.get(this.hash, `adoredBy`).removeAll();
            people.forEach((person) => {
              /**
               * Could do this through either tag, too, but let's say a subclass
               * wants to override things and attach some side effect to setting
               * their celebrity (subscribe to a news feed, maybe?).  To go
               * behind their backs and break the class invariant seems wrong.
               * In general, any foreign object should be respected by calling
               * its methods.
               */
              person.favoriteCelebrity.set(this);
            });
            return this;
          }
        };

        /** and the many to one end... */
        this.favoriteCelebrity = {
          get: () => {
            /** back to throwing out what I don't want. */
            return favCelebrity.get(this.hash, `favoriteCelebrity`)
              .data().map(name => new Person(name))[0];
          },
          set: (person: IPerson) => {
            const hash = new Person(person.name).hash;
            favCelebrity.get(this.hash, `favoriteCelebrity`).removeAll();
            favCelebrity.put(this.hash, hash, `favoriteCelebrity`);
            return this;
          }
        };
      });

      /** examples of more complicated entry types */
      //TODO
    }

    /**
     * Monologue on what I did here
     * TODO
     */
    namespace pals {
      const tag = new LinkRepo<Name, Name, "friends">(`PersonLinks`);

      tag.linkBack(`friends`);

      Person.onConstruct(function () {
        this.friends = {
          get: () => {
            return tag.get(this.hash, `friends`).data().map(name => new Person(name));
          },
          set: (to: IPerson[]) => {
            tag.get(this.hash, `friends`).removeAll();
            to.forEach((ip) => {
              const ph = new Person(ip.name).hash;
              tag.put(this.hash, ph, `friends`);
            });
            return this;
          }
        };
      });
    }

    /**
     * Some advanced concepts and more complicated sets of linkbacks
     * TODO
     */
  }

}
