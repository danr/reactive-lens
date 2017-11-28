
/** Store for some state

Store laws (assuming no listeners):

1. `s.set(a).get() = a`

2. `s.set(s.get()).get() = s.get()`

3. `s.set(a).set(b).get() = s.set(b).get()`

Store laws with listeners:

1. `s.transaction(() => s.set(a).get()) = a`

2. `s.transaction(() => s.set(s.get()).get()) = s.get()`

3. `s.transaction(() => s.set(a).set(b).get()) = s.set(b).get()`

A store is a partially applied, existentially quantified lens with a change listener.
*/
export class Store<S> {
  private constructor(
    private readonly transact: (m: () => void) => void,
    private readonly listen: (k: () => void) => () => void,
    private readonly _get: () => S,
    private readonly _set: (s: S) => void)
  { }

  /** Make the root store (static method) */
  static init<S>(s0: S): Store<S> {
    /** Current state */
    let s = s0
    /** Transaction depth, only notify when setting at depth 0 */
    let depth = 0
    /** Only notify on transacts that actually did set */
    let pending = false
    /** Listeners */
    const listeners = ListWithRemove<() => void>()
    /** Notify listeners if applicable */
    function notify(): void {
      if (depth == 0 && pending) {
        pending = false
        // must use a transact because listeners might set the state again
        transact(() => listeners.iter(k => k()))
      }
    }
    function transact(m: () => void): void {
      depth++
      m()
      depth--
      notify()
    }
    const set =
      (v: S) => {
        s = v
        pending = true
        notify()
      }
    return new Store(transact, k => listeners.push(k), () => s, set)
  }

  /** Get the current value (which must not be mutated)

      const store = Store.init(1)
      store.get()
      // => 1

  */
  get(): S {
    return this._get()
  }

  /** Set the value

      const store = Store.init(1)
      store.set(2)
      store.get()
      // => 2

  Returns itself. */
  set(s: S): Store<S> {
    this._set(s)
    return this
  }

  /** Update some parts of the state, keep the rest constant

      const store = Store.init({a: 1, b: 2})
      store.update({a: 3})
      store.get()
      // => {a: 3, b: 2}

  Returns itself. */
  update<K extends keyof S>(parts: {[k in K]: S[K]}): Store<S> {
    const keys = Object.keys(parts) as K[]
    this.transact(() => {
      keys.forEach(k => this.at(k).set(parts[k]))
    })
    return this
  }

  /** Modify the value in the store (must not use mutation: construct a new value)

      const store = Store.init(1)
      store.modify(x => x + 1)
      store.get()
      // => 2

  Returns itself. */
  modify(f: (s: S) => S): Store<S> {
    this.set(f(this.get()))
    return this
  }

  /** React on changes. Returns the unsubscribe function.

      const store = Store.init(1)
      let last
      const off = store.on(x => last = x)
      store.set(2)
      last // => 2
      off()
      store.set(3)
      last // => 2

  */
  on(k: (s: S) => void): () => void {
    return this.listen(() => k(this.get()))
  }

  /** React on a difference in value. Returns the unsubscribe function.

        const store = Store.init({a: 0})
        let diffs = 0
        const off = store.ondiff((new_value, old) => {
          assert.notEqual(new_value, old)
          diffs++
        })
        diffs // => 0
        const object = {a: 1}
        store.set(object)            // diff: new object
        diffs                        // => 1
        store.set(object)            // no diff: same object
        diffs                        // => 1
        store.set({a: 2})            // diff: new object
        diffs                        // => 2
        store.set({a: 2})            // diff: this is yet another new literal object
        diffs                        // => 3
        store.set(store.get())       // no diff: same object
        diffs                        // => 3
        store.modify(x => x)         // no diff: same object
        diffs                        // => 3
        store.at('a').modify(x => x) // diff: at does not see if the value actually changed
        diffs                        // => 4

  Note: keeps a reference to the last value in memory. */
  ondiff(k: (new_value: S, old_value: S) => void): () => void {
    let old_value = this.get()
    return this.on(new_value => {
      if (new_value !== old_value) {
        k(new_value, old_value)
        old_value = new_value
      }
    })
  }


  /** Start a new transaction: listeners are only invoked when the
  (top-level) transaction finishes, and not on set (and modify) inside the transaction.

      const store = Store.init(1)
      let last
      store.on(x => last = x)
      store.transaction(() => {
        store.set(2)
        assert.equal(last, undefined)
        return 3
      })   // => 3
      last // => 2

  */
  transaction<A>(m: () => A): A {
    let a: A | undefined
    this.transact(() => {
      a = m()
    })
    return a as A // unsafe cast, but safe because transact will run m (exactly once)
  }

  /** Zoom in on a subpart of the store via a lens

      const store = Store.init({a: 1, b: 2} as Record<string, number>)
      const a_store = store.via(Lens.key('a'))
      a_store.set(3)
      store.get() // => {a: 3, b: 2}
      a_store.get() // => 3
      a_store.set(undefined)
      store.get() // => {b: 2}

  */
  via<T>(lens: Lens<S, T>) {
    return new Store(
      this.transact,
      this.listen,
      () => lens.get(this.get()),
      (t: T) => this.set(lens.set(this.get(), t)))
      // possible "optimization": only set if t /= lens.get()
  }

  /** Make a substore at a key

      const store = Store.init({a: 1, b: 2})
      store.at('a').set(3)
      store.get() // => {a: 3, b: 2}
      store.at('a').get() // => 3

  Note: the key must always be present. */
  at<K extends keyof S>(k: K): Store<S[K]> {
    return this.via(Lens.at(k))
  }

  /** Make a substore by picking many keys

      const store = Store.init({a: 1, b: 2, c: 3})
      store.pick('a', 'b').get() // => {a: 1, b: 2}
      store.pick('a', 'b').set({a: 5, b: 4})
      store.get() // => {a: 5, b: 4, c: 3}

  Note: the keys must always be present. */
  pick<Ks extends keyof S>(...ks: Ks[]): Store<{[K in Ks]: S[K]}> {
    return this.via(Lens.pick(...ks))
  }

  /** Make a substore which omits some keys

    const store = Store.init({a: 1, b: 2, c: 3, d: 4})
    const cd = store.omit('a', 'b')
    cd.get() // => {c: 3, d: 4}
    cd.set({c: 5, d: 6})
    store.get() // {a: 1, b: 2, c: 5, d: 6}

  */
  omit<K extends keyof S>(...ks: K[]): Store<Omit<S, K>> {
    return this.via(Lens.omit(...ks))
  }

  /** Make a substore by relabelling

      const store = Store.init({a: 1, b: 2, c: 3})
      const other = store.relabel({x: store.at('a'), y: store.at('b')})
      other.get() // => {x: 1, y: 2}
      other.set({x: 5, y: 4})
      store.get() // => {a: 5, b: 4, c: 3}

  Note: must not use the same part of the store several times. */
  relabel<T>(stores: {[K in keyof T]: Store<T[K]>}): Store<T> {
    const keys = Object.keys(stores) as (keyof T)[]
    return new Store(
      this.transact,
      this.listen,
      () => {
        const ret = {} as T
        keys.forEach(k => {
          ret[k] = stores[k].get()
        })
        return ret
      },
      (t: T) => {
        this.transact(() => {
          keys.forEach(k => {
            stores[k].set(t[k])
          })
        })
      })
  }

  /** Merge two stores

      const store = Store.init({a: 1, b: 2, c: 3})
      const small = store.pick('a')
      const other = small.merge(store.relabel({z: store.at('c')}))
      other.get() // => {a: 1, z: 3}
      other.set({a: 0, z: 4})
      store.get() // => {a: 0, b: 2, c: 4}

  Note: the two stores must originate from the same root.
  Note: this store and the other store must both be objects.
  Note: must not use the same part of the store several times. */
  merge<T>(other: Store<T>): Store<S & T> {
    const other_keys = {} as {[K in keyof T]: true}
    Object.keys(other.get()).forEach((k: keyof T) => other_keys[k] = true)
    return new Store(
      this.transact,
      this.listen,
      () => ({...this.get() as any, ...other.get() as any}),
      (t: S & T) => {
        this.transact(() => {
          Object.keys(t).forEach(k => {
            if (k in other_keys) {
              other.at(k as keyof T).set((t as any)[k])
            } else {
              this.at(k as keyof S).set((t as any)[k])
            }
          })
        })
      })

  }

  /** Set the value using an array method (purity is ensured because the spine is copied before running the function)

      const store = Store.init(['a', 'b', 'c', 'd'])
      Store.arr(store, 'splice')(1, 2, 'x', 'y', 'z') // => ['b', 'c']
      store.get() // => ['a', 'x', 'y', 'z', 'd']

  (static method) */
  static arr<A, K extends keyof Array<A>>(store: Store<Array<A>>, k: K): Array<A>[K] {
    return (...args: any[]) => {
      const xs = store.get().slice()
      const ret = (xs[k] as any)(...args)
      store.set(xs)
      return ret
    }
  }

  /** Get partial stores for each position currently in the array

      const store = Store.init(['a', 'b', 'c'])
      Store.each(store).map((substore, i) => substore.modify(s => s + i.toString()))
      store.get() // => ['a0', 'b1', 'c2']

  (static method)

  Note: exceptions are thrown when looking outside the array. */
  static each<A>(store: Store<A[]>): Store<A>[] {
    return store.get().map((_, i) => store.via(Lens.index(i)))
  }

  /** Connect with local storage */
  storage_connect(
      key: string = 'state',
      audit: (s: S) => boolean = () => true,
      api: {
        get: (key: string) => string | null,
        set: (key: string, data: string) => void
      } = {
        get: window.localStorage.getItem.bind(window.localStorage),
        set: window.localStorage.setItem.bind(window.localStorage)
      }
    ): () => void
  {
    const stored = api.get(key)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (audit(parsed)) {
          this.set(parsed)
        }
      } catch (_) {
        // pass
      }
    }
    return this.on(s => api.set(key, JSON.stringify(s)))
  }

  /** Connect with window.location.hash */
  location_connect(
      to_hash: (state: S) => string,
      from_hash: (hash: string) => S | undefined,
      api: {
        get(): string,
        set(hash: string): void,
        on(cb: () => void): void
      } = {
        get() { return window.location.hash },
        set(s) { window.location.hash = s },
        on(cb) { window.onhashchange = cb }
      }
    ): () => void
  {
    let self = false
    function update() {
      if (!self) {
        const updated = from_hash(api.get())
        if (updated !== undefined) {
          this.set(updated)
        } else {
          // gibberish, just revert it to what is now
          self = true
          api.set(to_hash(this.get()))
        }
      } else {
        self = false
      }
    }
    api.on(update.bind(this))
    update.apply(this)
    return this.on(x => {
      const hash = to_hash(x)
      if (hash != api.get()) {
        self = true // we don't need to react on this
        api.set(hash)
      }
    })
  }
}

/** A lens: allows you to operate on a subpart `T` of some data `S`

Lenses must conform to these three lens laws:

* `l.get(l.set(s, t)) = t`

* `l.set(s, l.get(s)) = s`

* `l.set(l.set(s, a), b) = l.set(s, b)`
*/
export interface Lens<S, T> {
  /** Get the value via the lens */
  get(s: S): T,

  /** Set the value via the lens */
  set(s: S, t: T): S
}

/** Common lens constructors and functions */
export module Lens {
  /** Make a lens from a getter and setter

  Note: lenses are subject to the three lens laws */
  export function lens<S, T>(get: (s: S) => T, set: (s: S, t: T) => S): Lens<S, T> {
    return {get, set}
  }

  /** Lens from a record of lenses

  Note: must not use the same part of the store several times. */
  export function relabel<S, T>(lenses: {[K in keyof T]: Lens<S, T[K]>}): Lens<S, T> {
    const keys = Object.keys(lenses) as (keyof T)[]
    return lens(
      s => {
        const ret = {} as T
        keys.forEach(k => {
          ret[k] = lenses[k].get(s)
        })
        return ret
      },
      (s, t) => {
        let r = s
        keys.forEach(k => {
          r = lenses[k].set(r, t[k])
        })
        return r
      })
  }

  /** Lens to a key in a record

  Note: the key must always be present. */
  export function at<S, K extends keyof S>(k: K): Lens<S, S[K]> {
    return lens(
      s => s[k],
      (s, v) => ({...(s as any), [k as string]: v}))
                // unsafe cast // safe cast
  }

  /** Make a lens from an isomorphism.

      const store = Store.init(5)
      const doubled = store.via(Lens.iso(x => 2 * x, x => x / 2))
      doubled.get() // => 10
      doubled.set(50)
      store.get() // => 25
      doubled.modify(x => x * 2).get() // => 100
      store.get() // => 50

  Note: requires that for all `s` and `t` we have `f(g(t)) = t` and `g(f(s)) = s` */
  export function iso<S, T>(f: (s: S) => T, g: (t: T) => S): Lens<S, T> {
    return lens(f, (_s: S, t: T) => g(t))
  }

  /** Lens to a keys in a record

  Note: the keys must always be present. */
  export function pick<S, Ks extends keyof S>(...keys: Ks[]): Lens<S, {[K in Ks]: S[K]}> {
    const lenses = {} as {[K in Ks]: Lens<S, S[K]>}
    keys.forEach((k: Ks) => lenses[k] = at(k))
    return relabel(lenses)
  }

  /** Lens to a key in a record which may be missing

  Note: setting the value to undefined removes the key from the record. */
  export function key<S, K extends keyof S>(k: K): Lens<S, S[K] | undefined> {
    return lens(
      x => x[k],
      (s, v) => {
        // as string: safe cast
        // as any: https://github.com/Microsoft/TypeScript/issues/14409
        if (v === undefined) {
          const copy = {} as S
          for (let i in s) {
            if (i != k) {
              copy[i] = s[i]
            }
          }
          return copy
        } else {
          return {
            ...(s as any),
            [k as string]: v
          }
        }
      }
    )
  }

  /** Lens which refer to a default value instead of undefined

      const store = Store.init({a: 1, b: 2} as Record<string, number>)
      const a_store = store.via(Lens.key('a')).via(Lens.def(0))
      a_store.set(3)
      store.get() // => {a: 3, b: 2}
      a_store.get() // => 3
      a_store.set(0)
      store.get() // => {b: 2}
      a_store.modify(x => x + 1)
      store.get() // => {a: 1, b: 2}

  */
  export function def<A>(missing: A): Lens<A | undefined, A> {
  return iso(
    a => a === undefined ? missing : a,
    a => a === missing ? undefined : a)
  }

  /** Compose two lenses sequentially */
  export function seq<S, T, U>(lens1: Lens<S, T>, lens2: Lens<T, U>): Lens<S, U> {
    return lens(
      (s: S) => lens2.get(lens1.get(s)),
      (s: S, u: U) => lens1.set(s, lens2.set(lens1.get(s), u))
    )
  }

  /** Make a lens which omits some keys */
  export function omit<S, K extends keyof S>(...ks: K[]): Lens<S, Omit<S, K>> {
    const curry = (s: S) => {
      const all_keys = Object.keys(s) as (keyof S)[]
      const picked = all_keys.filter(x => -1 == ks.indexOf(x as K))
      return (Lens.pick as any)(...picked)
    }
    return Lens.lens((s) => curry(s).get(s), (s, t) => curry(s).set(s, t))
  }


  /** Partial lens to a particular index in an array

      const store = Store.init([0, 1, 2, 3])
      const first = store.via(Lens.index(0))
      first.get() // => 0
      first.set(99)
      store.get() // => [99, 1, 2, 3]

  Note: an exception is thrown if you look outside the array. */
  export function index<A>(i: number): Lens<A[], A> {
    const within = (xs: A[]) => {
      if (i < 0 || i >= xs.length) {
        throw 'Out of bounds'
      }
    }
    return lens(
      xs => (within(xs), xs[i]),
      (xs, x) => {
        within(xs)
        const ys = xs.slice()
        ys[i] = x
        return ys
      })
  }
}

/** History zipper functions

    const {undo, redo, advance, advance_to} = Undo
    const store = Store.init(Undo.init({a: 1, b: 2}))
    const modify = op => store.modify(op)
    const now = store.at('now')
    now.get() // => {a: 1, b: 2}
    modify(advance_to({a: 3, b: 4}))
    now.get() // => {a: 3, b: 4}
    modify(undo)
    now.get() // => {a: 1, b: 2}
    modify(redo)
    now.get() // => {a: 3, b: 4}
    modify(advance)
    now.update({a: 5})
    now.get() // => {a: 5, b: 4}
    modify(undo)
    now.get() // => {a: 3, b: 4}
    modify(undo)
    now.get() // => {a: 1, b: 2}
    modify(undo)
    now.get() // => {a: 1, b: 2}

*/
export module Undo {
  /** Undo iff there is a past */
  export function undo<S>(h: Undo<S>): Undo<S> {
    if (h.prev != null) {
      return {
        now: h.prev.top,
        prev: h.prev.pop,
        next: {top: h.now, pop: h.next}
      }
    } else {
      return h
    }
  }

  /** Redo iff there is a future */
  export function redo<S>(h: Undo<S>): Undo<S> {
    if (h.next != null) {
      return {
        now: h.next.top,
        prev: {top: h.now, pop: h.prev},
        next: h.next.pop
      }
    } else {
      return h
    }
  }

  /** Advances the history by copying the present state */
  export function advance<S>(h: Undo<S>): Undo<S> {
    return {
      now: h.now,
      prev: {top: h.now, pop: h.prev},
      next: null
    }
  }

  /** Initialise the history */
  export function init<S>(now: S): Undo<S> {
    return {
      now,
      prev: null,
      next: null
    }
  }

  /** Advances the history to some new state */
  export function advance_to<S>(s: S): (h: Undo<S>) => Undo<S> {
    return h => Lens.at<typeof h, 'now'>('now').set(advance(h), s)
  }

  /** Is there a state to undo to? */
  export function can_undo<S>(h: Undo<S>): boolean {
    return h.prev != null
  }

  /** Is there a state to redo to? */
  export function can_redo<S>(h: Undo<S>): boolean {
    return h.next != null
  }
}

/** History zipper */
export interface Undo<S> {
  readonly now: S
  readonly prev: null | Stack<S>,
  readonly next: null | Stack<S>,
}

/** A non-empty stack */
export interface Stack<S> {
  readonly top: S
  readonly pop: null | Stack<S>
}

/** List with iteration and O(1) push and remove */
function ListWithRemove<A>() {
  const dict = {} as Record<string, A>
  let order = [] as number[]
  let next_unique = 0
  let dirty = false

  return {
    /** Push a new element, returns the delete function */
    push(a: A): () => void {
      const id = next_unique++
      dict[id] = a
      order.push(id)
      return () => {
        delete dict[id]
        dirty = true
      }
    },
    /** Iterate over the elements */
    iter(f: (a: A) => void): void {
      if (dirty) {
        order = order.filter(id => id in dict)
        dirty = false
      }
      order.forEach(id => {
        if (id in dict) {
          f(dict[id])
        }
      })
    }
  }
}

/** Utility functions to make Elm/Redux-style requests

A queue of requests are maintained in an array.

TODO: Document and test. */
export module Requests {
  /** Make a function for making requests */
  export function request_maker<R>(store: Store<R[]>): (request: R) => void {
    return Store.arr(store, 'push')
  }

  /** Make a request */
  export function request<R>(store: Store<R[]>, request: R): void {
    request_maker(store)(request)
  }

  /** Process requests, one at a time

  Retuns the off function. */
  export function process_requests<R>(store: Store<R[]>, process: (request: R) => void): () => void {
    return store.ondiff(requests => {
      if (requests.length > 0) {
        store.transaction(() => {
          store.set([])
          requests.forEach(process)
        })
      }
    })
  }
}

// From: http://ideasintosoftware.com/typescript-advanced-tricks/
export type Diff<T extends string, U extends string> = ({[P in T]: P } & {[P in U]: never } & { [x: string]: never })[T]
export type Omit<T, K extends keyof T> = {[P in Diff<keyof T, K>]: T[P]}


