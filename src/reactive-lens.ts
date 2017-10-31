
/** Store for some state

Store laws (assuming no listeners):

```
s.set(a).get() = a

s.set(s.get()).get() = s.get()

s.set(a).set(b).get() = s.set(b).get()
```

Store laws with listeners:

```
s.transaction(() => s.set(a).get()) = a

s.transaction(() => s.set(s.get()).get()) = s.get()

s.transaction(() => s.set(a).set(b).get()) = s.set(b).get()
```

A store is a partially applied, existentially quantified lens with a change listener.
*/
export class Store<S> {
  private constructor(
    private readonly transact: (m: () => void) => void,
    private readonly listen: (k: () => void) => () => void,
    private readonly _get: () => S,
    private readonly _set: (s: S) => void)
  { }

  /** Make the root store */
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
  }

  /** Start a new transaction: listeners are only invoked when the
  (top-level) transaction finishes, and not on set (and modify) inside the transaction. */
  transaction<A>(m: () => A): A {
    let a: A | undefined
    this.transact(() => {
      a = m()
    })
    return a as A // unsafe cast, but safe because transact will run m (exactly once)
  }

  /** Get the current value (which must not be mutated) */
  get(): S {
    return this._get()
  }

  /** Set the value

  Returns itself. */
  set(s: S): Store<S> {
    this._set(s)
    return this
  }

  /** Modify the value in the store (must not use mutation: construct a new value)

  Returns itself. */
  modify(f: (s: S) => S): Store<S> {
    this.set(f(this.get()))
    return this
  }

  /** React on changes. Returns an unsubscribe function. */
  on(k: (s: S) => void): () => void {
    return this.listen(() => k(this.get()))
  }

  /** Zoom in on a subpart of the store via a lens */
  zoom<T>(lens: Lens<S, T>) {
    return new Store(
      this.transact,
      this.listen,
      () => lens.get(this.get()),
      (t: T) => this.set(lens.set(this.get(), t)))
  }

  /** Make a substore at a key

  Note: the key must always be present. */
  at<K extends keyof S>(k: K): Store<S[K]> {
    return this.zoom(Lens.at(k))
  }

  /** Make a substore by picking many keys

  Note: the keys must always be present. */
  pick<Ks extends keyof S>(...ks: Ks[]): Store<{[K in Ks]: S[K]}> {
    return this.zoom(Lens.pick(...ks))
  }

  /** Make a substore by relabelling

  Note: must not use the same part of the store several times. */
  relabel<T>(lenses: {[K in keyof T]: Store<T[K]>}): Store<T> {
    const keys = Object.keys(lenses) as (keyof T)[]
    return new Store(
      this.transact,
      this.listen,
      () => {
        const ret = {} as T
        keys.forEach(k => {
          ret[k] = lenses[k].get()
        })
        return ret
      },
      (t: T) => {
        this.transact(() => {
          keys.forEach(k => {
            lenses[k].set(t[k])
          })
        })
      })
  }

  /** Apply a lens along one field, keep the rest of the shape intact */
  along<K extends keyof S, Ks extends keyof S, B>(k: K, i: Lens<S[K], B>, ...keep: Ks[]): Store<{[k in K]: B} & {[k in Ks]: S[k]}> {
    return this.zoom(Lens.along(this)(k, i, ...keep))
  }

  /** Partial substore makers */
  static readonly partial = {
    /** Get partial stores for each position currently in the array

    Note: exceptions are thrown when looking outside the array. */
    each<A>(store: Store<A[]>): Store<A>[] {
      return store.get().map((_, i) => store.zoom(Lens.partial.index(i)))
    }
  }
}

/** A simple lens */
export interface Lens<S, T> {
  /** Get the current value */
  get(s: S): T,

  /** Set the current value*/
  set(s: S, t: T): S
}

/** Utility functions on lenses */
export module Lens {
  /** Make a lens from a getter and setter

  Note: lenses are subject to three lens laws */
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

  /** Make an isomorphism. Every isomorphism is a lens.

  Note: requires that for all s and t we have f(g(t)) = t and g(f(s)) = s */
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

  /** Lens which refer to a default value instead of undefined */
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

  /** Set using an array method (purity is ensured because the spine is copied before running the function) */
  export function arr<A, K extends keyof Array<A>>(store: Store<Array<A>>, k: K): Array<A>[K] {
    return (...args: any[]) => {
      const xs = store.get().slice()
      const ret = (xs[k] as any)(...args)
      store.set(xs)
      return ret
    }
  }

  /** Apply a lens along one field, keep the rest of the shape intact */
  export function along<S>(type_hint?: Store<S> | (() => S)): <K extends keyof S, Ks extends keyof S, B>(k: K, i: Lens<S[K], B>, ...keep: Ks[]) => Lens<S, {[k in K]: B} & {[k in Ks]: S[k]}> {
    function ret<K extends keyof S, Ks extends keyof S, B>(k: K, i: Lens<S[K], B>, ...keep: Ks[]): Lens<S, {[k in K]: B} & {[k in Ks]: S[k]}> {
      return lens(
        (s: S) => ({...(s as any), [k as any]: i.get(s[k])}),
        (s: S,
         t: {[K in Ks]: S[K]} & {[k in K]: B}) => ({...(t as any), [k as any]: i.set(s[k], (t as {[k in K]: B})[k])})
      )
    }
    return ret
  }

  /** Partial lenses */
  export module partial {
    /** Partial lens to a particular index in an array

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
}

/** History zipper */
export interface Undo<S> {
  readonly tip: Stack<S>,
  readonly next: null | Stack<S>,
}

/** A non-empty stack */
export interface Stack<S> {
  readonly top: S
  readonly pop: null | Stack<S>
}

/** History zipper functions

Todo: document this without puns and semi-obscure references */
export module Undo {
  /** Undo iff there is a past */
  export function undo<S>(h: Undo<S>): Undo<S> {
    if (h.tip.pop != null) {
      return {
        tip: h.tip.pop,
        next: {top: h.tip.top, pop: h.next}
      }
    } else {
      return h
    }
  }

  /** Redo iff there is a future */
  export function redo<S>(h: Undo<S>): Undo<S> {
    if (h.next != null) {
      return {
        tip: {top: h.next.top, pop: h.tip},
        next: h.next.pop
      }
    } else {
      return h
    }
  }

  /** Advances the history by copying the present */
  export function advance<S>(h: Undo<S>): Undo<S> {
    return {
      tip: {top: h.tip.top, pop: h.tip},
      next: null
    }
  }

  /** Make history */
  export function init<S>(now: S): Undo<S> {
    return {
      tip: {top: now, pop: null},
      next: null
    }
  }

  /** Lens to the present moment */
  export function now<S>(): Lens<Undo<S>, S> {
    return Lens.lens(
      h => h.tip.top,
      (h, v) => ({tip: {top: v, pop: h.tip.pop}, next: h.next})
    )
  }
}

