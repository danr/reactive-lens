/** A simple lens */
export interface Lens<S, T> {
  get(s: S): T,
  set(s: S, t: T): S
}

/** Store for some state

Store laws (assuming no listeners):

    s.set(a).get() = a

    s.set(s.get()).get() = s.get()

    s.set(a).set(b).get() = s.set(b).get()

*/
export interface Store<S> {
  /** Get the current value (which must not be mutated) */
  get(): S

  /** Set the value

  Returns itself. */
  set(s: S): Store<S>

  /** Modify the value in the store (must not use mutation: construct a new value)

  Returns itself. */
  modify(f: (s: S) => S): Store<S>

  /** React on changes. Returns an unsubscribe function. */
  on(k: (s: S) => void): () => void

  /** Start a new transaction: listeners are only invoked when the
  (top-level) transaction finishes, and not on set (and modify) inside the transaction. */
  transaction(m: () => void): void

  /** Make a new store by projecting at a subfield.

  Note: use only when S is an object which always has this key. */
  at<K extends keyof S>(k: K): Store<S[K]>

  /** Make a reference at a particular key in a record.

  Note: the key may be missing from the record.
  Note: setting the value to undefined removes the key from the record. */
  key<K extends keyof S>(k: K): Store<S[K] | undefined>

  /** Make a new store via a lens */
  via<T>(lens: Lens<S, T>): Store<T>

  /** Make a substore with respect to some base store */
  substore<T>(get: () => T, set: (s: T) => void): Store<T>
}

/** reactive-lens API */
export interface ReactiveLensesAPI {
  /** Make the root store */
  init<S>(s0: S): Store<S>

  /** Make a new store a record of stores */
  record<R>(stores: {[P in keyof R]: Store<R[P]>}): Store<R>

  /** Get partial stores for each position currently in the array */
  each<A>(store: Store<A[]>): Store<A>[]

  /** Set using an array method (purity is ensured because the spine is copied before running the function) */
  arr<A, K extends keyof A[]>(store: Store<A[]>, k: K): A[][K]

  /** Lens which refer to a default value instead of undefined */
  def<A>(missing: A): Lens<A | undefined, A>

  /** Partial lens to a particular index in an array

  Note: an exception is thrown if you look outside the array.
  */
  index<A>(position: number): Lens<A[], A>

  /** Make a lens from a getter and setter */
  lens<S, T>(get: (s: S) => T, set: (s: S, t: T) => S): Lens<S, T>

  /** Make a lens from an isomorphism

  Note: requires that for all s and t we have f(g(t)) = t and g(f(s)) = s */
  iso<S, T>(f: (s: S) => T, g: (t: T) => S): Lens<S, T>

  /** Lens to a subfield which must be present. */
  at<S, K extends keyof S>(k: K): Lens<S, S[K]>

  /** Lens to a particular key in a record.

  Note: the key may be missing from the record.
  Note: setting the value to undefined removes the key from the record. */
  key<S, K extends keyof S>(k: K): Lens<S, S[K] | undefined>

  /** Compose two lenses */
  via<S,T,U>(lens1: Lens<S, T>, lens2: Lens<T, U>): Lens<S, U>
}

class StoreClass<S> implements Store<S> {
  private constructor(
    public readonly transaction: (m: () => void) => void,

    private readonly listen: (k: () => void) => () => void,

    public readonly get: () => S,

    private readonly _set: (s: S) => void)
  { }

  static init<S>(s0: S): Store<S> {
    /** Current state */
    let s = s0
    /** Transaction depth, only notify when setting at depth 0 */
    let depth = 0
    /** Only notify on transactions that actually did set */
    let pending = false
    /** Listeners */
    const listeners = ListWithRemove<() => void>()
    /** Notify listeners if applicable */
    function notify(): void {
      if (depth == 0 && pending) {
        pending = false
        // must use a transaction because listeners might set the state again
        transaction(() => listeners.iter(k => k()))
      }
    }
    function transaction(m: () => void) {
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
    return new StoreClass(transaction, k => listeners.push(k), () => s, set)
  }

  set(s: S): Store<S> {
    this._set(s)
    return this
  }

  modify(f: (s: S) => S): Store<S> {
    this.set(f(this.get()))
    return this
  }

  on(k: (s: S) => void): () => void {
    return this.listen(() => k(this.get()))
  }

  substore<T>(get: () => T, set: (s: T) => void): Store<T> {
    return new StoreClass(
      this.transaction,
      this.listen,
      get,
      set
    )
  }

  private lens<T>(get: (s: S) => T, set: (s: S, t: T) => S): Store<T> {
    return this.substore(
      () => get(this.get()),
      (t: T) => this.set(set(this.get(), t)))
  }

  via<T>(lens: Lens<S, T>) {
    return this.lens(lens.get, lens.set)
  }

  at<K extends keyof S>(k: K): Store<S[K]> {
    return this.via(at(k))
  }

  key<K extends keyof S>(k: K): Store<S[K] | undefined> {
    return this.via(key(k))
  }
}

function lens<S, T>(get: (s: S) => T, set: (s: S, t: T) => S): Lens<S, T> {
  return {get, set}
}

function iso<S, T>(f: (s: S) => T, g: (t: T) => S): Lens<S, T> {
  return lens(f, (_s: S, t: T) => g(t))
}

function at<S, K extends keyof S>(k: K): Lens<S, S[K]> {
  return lens(
    s => s[k],
    (s, v) => ({...(s as any), [k as string]: v}))
                // unsafe cast // safe cast
}

function key<S, K extends keyof S>(k: K): Lens<S, S[K] | undefined> {
  return lens(
    x => x[k],
    (s, v) => {
      // as string: safe cast
      // as any: https://github.com/Microsoft/TypeScript/issues/14409
      if (v == undefined) {
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

function def<A>(missing: A): Lens<A | undefined, A> {
  return iso(
    a => a === undefined ? missing : a,
    a => a === missing ? undefined : a)
}

function record<R>(stores: {[P in keyof R]: Store<R[P]>}): Store<R> {
  for (const base_key in stores) {
    const store = stores[base_key]
    return store.substore(
      () => {
        const ret = {} as R
        for (let k in stores) {
          ret[k] = stores[k].get()
        }
        return ret
      },
      (v: R) => {
        store.transaction(() => {
          for (let k in stores) {
            stores[k].set(v[k])
          }
        })
      }
    )
  }
  throw 'Empty record'
}

function via<S,T,U>(lens1: Lens<S, T>, lens2: Lens<T, U>): Lens<S, U> {
  return lens(
    (s: S) => lens2.get(lens1.get(s)),
    (s: S, u: U) => lens1.set(s, lens2.set(lens1.get(s), u))
  )
}

function index<A>(position: number): Lens<A[], A> {
  return lens(
    xs => {
      if (position < 0 || position >= xs.length) {
        throw 'Out of bounds'
      } else {
        return xs[position]
      }
    },
    (xs, x) => {
      if (position < 0 || position >= xs.length) {
        throw 'Out of bounds'
      }
      const ys = xs.slice()
      ys[position] = x
      return ys
    })
}

function each<A>(store: Store<A[]>): Store<A>[] {
  return store.get().map((_, i) => store.via(index(i)))
}

function arr<A, K extends keyof Array<A>>(store: Store<Array<A>>, k: K): Array<A>[K] {
  return (...args: any[]) => {
    const xs = store.get().slice()
    const ret = (xs[k] as any)(...args)
    store.set(xs)
    return ret
  }
}

export const Store: ReactiveLensesAPI = {
  init: StoreClass.init,
  def,
  record,
  index,
  each,
  arr,
  via,
  lens,
  iso,
  at,
  key
}

interface ListWithRemove<A> {
  /** Push a new element, returns the delete function */
  push(a: A): () => void,
  /** Iterate over the elements */
  iter(f: (a: A) => void): void
}

function ListWithRemove<A>(): ListWithRemove<A> {
  const dict = {} as Record<string, A>
  let order = [] as (string[] | null)
  let next_unique = 0

  return {
    push(a) {
      const id = next_unique++ + ''
      dict[id] = a
      if (order != null) {
        order.push(id)
      }
      return () => {
        delete dict[id]
        order = null
      }
    },
    iter(f) {
      if (order == null) {
        const cmp = (a: string, b: string) => parseInt(a) - parseInt(b)
        order = Object.keys(dict).sort(cmp)
      }
      order.map(id => {
        if (id in dict) {
          f(dict[id])
        }
      })
    }
  }
}
