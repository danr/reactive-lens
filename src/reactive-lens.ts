
/** Storing state */
export class Store<S> {
  private constructor(
    /** Start a new transaction: allows using set and modify many times,
    and only when the (top-level) transaction is finished listeners will be
    notified. */
    public readonly transaction: (m: () => void) => void,

    /** React on changes. returns an unsubscribe function */
    private readonly listen: (k: () => void) => () => void,

    /** Get the current value

    Note: do not mutate the returned value */
    public readonly get: () => S,

    /** Set to a new value */
    public readonly set: (s: S) => void)
  { }

  /** Make the root store */
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
    return new Store(transaction, k => listeners.push(k), () => s, set)

    interface ListWithRemove<A> {
      push(a: A): () => void,
      iter(f: (a: A) => void): void
    }

    function ListWithRemove<A>(): ListWithRemove<A> {
      const dict = {} as Record<string, A>
      let order = [] as (string[] | null)
      let next_unique = 0

      /** Push a new element, returns the delete function */
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

  }

  /** Make a substore with respect to some base store */
  static sub<B, T>(base: Store<B>, get: () => T, set: (s: T) => void): Store<T> {
    return new Store(
      base.transaction,
      base.listen,
      get,
      set
    )
  }

  /** React on changes. returns an unsubscribe function */
  on(k: (s: S) => void): () => void {
    return this.listen(() => k(this.get()))
  }

  /** Modify the value in the store

  Note: return a new value (do not mutate it) */
  modify(f: (s: S) => S): void {
    return this.set(f(this.get()))
  }

  /** Make a new store by projecting a subfield.

  Note: use only when S is actually an object, which always has the key k. */
  at<K extends keyof S>(k: K): Store<S[K]> {
    return this.lens(s => s[k], (s, v) => ({...(s as any), [k as string]: v}))
                                            // unsafe cast
                                                           // safe cast
  }

  /** Make a reference at a particular key in a record.

  Note: the key may be missing from the record.
  Note: setting the value to undefined removes the key from the record. */
  key<K extends keyof S>(k: K): Store<S[K] | undefined> {
    return this.lens(
      x => x[k],
      (s, v) => {
        // as string: safe cast
        // as any: https://github.com/Microsoft/TypeScript/issues/14409
        if (v == undefined) {
          const {[k as string]: _, ...s2} = s as any
          return s2
        } else {
          return {
            ...(s as any),
            [k as string]: v
          }
        }
      }
    )
  }

  /** Transform a store via an isomorphism

  Note: requires that for all s and t we have f(g(t)) = t and g(f(s)) = s */
  iso<T>(f: (s: S) => T, g: (t: T) => S): Store<T> {
    return Store.sub(
      this,
      () => f(this.get()),
      (t: T) => this.set(g(t))
    )
  }

  /** Make a derived store */
  lens<T>(project: (s: S) => T, inject: (s: S, t: T) => S): Store<T> {
    return this.iso(project, t => inject(this.get(), t))
  }


/** Refer to a default value instead of undefined */
static def<A>(store: Store<A | undefined>, missing: A): Store<A> {
  return store.iso(
    a => a === undefined ? missing : a,
    a => a === missing ? undefined : a)
}

  /** Make a new reference from many in a record */
  static record<R>(stores: {[P in keyof R]: Store<R[P]>}): Store<R> {
    for (const base_key in stores) {
      const store = stores[base_key]
      return Store.sub(
        store,
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
    throw "Empty record"
  }

  /** Make a reference to a particular index in an array */
  static index<A>(store: Store<A[]>, position: number): Store<A | undefined> {
    return store.lens(
      xs => xs[position],
      (xs, x) => {
        if (position < xs.length) {
          const a = xs.slice(0, position)
          const z = xs.slice(position + 1)
          if (x === undefined) {
            return inplace_rtrim([...a, ...z])
          } else {
            return inplace_rtrim([...a, x, ...z])
          }
        } else {
          const ys = xs.slice()
          if (x !== undefined) {
            // pre-fill with undefined:
            while (ys.length < position) {
              ys.push(undefined as any as A)
            }
            ys.push(x)
          }
          return inplace_rtrim(ys)
        }
      }
    )
    function inplace_rtrim(ys: A[]): A[] {
      while (ys.length > 0 && ys[ys.length - 1] === undefined) {
        ys.pop()
      }
      return ys
    }
  }

  /** Get stores to each position currently in the array */
  static each<A>(store: Store<A[]>): Store<A | undefined>[] {
    return store.get().map((_, i) => Store.index(store, i))
  }

  /** Paginate a store into equal pieces of a chunk size, which is either constant or calculated from the page index */
  static paginate<A>(store: Store<A[]>, chunk_size: number | ((i: number) => number)): Store<A[][]> {
    return store.iso(
      chunk,
      xss => ([] as A[]).concat(...xss)
    )
    function chunk<A>(xs: A[]): A[][] {
      const out = [] as A[][]
      const f = typeof chunk_size == 'number' ? (_: number) => chunk_size : chunk_size
      for (let i = 0, j = 0; i < xs.length; j++) {
        const n = f(j)
        out.push(xs.slice(i, i + n))
        i += n
      }
      return out
    }
  }
}

