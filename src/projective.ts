
/** Storing state */
export class Ref<S> {
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

  /** React on changes. returns an unsubscribe function */
  on(k: (s: S) => void): () => void {
    return this.listen(() => k(this.get()))
  }

  /** Modify the value in the reference

  Note: return a new value (do not mutate it) */
  modify(f: (s: S) => S): void {
    return this.set(f(this.get()))
  }

  /** Make a new reference by projecting a subfield.

  Note: use only when S is actually an object, which always has the key k. */
  at<K extends keyof S>(k: K): Ref<S[K]> {
    return this.lens(s => s[k], (s, v) => ({...(s as any), [k as string]: v}))
                                            // unsafe cast
                                                           // safe cast
  }

  /** Make a reference at a particular key in a record.

  Note: the key may be missing from the record.
  Note: setting the value to undefined removes the key from the record. */
  key<K extends keyof S>(k: K): Ref<S[K] | undefined> {
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

  /** Refer to a default value instead of undefined */
  static def<A>(ref: Ref<A | undefined>, missing: A): Ref<A> {
    return ref.iso(
      a => a === undefined ? missing : a,
      a => a === missing ? undefined : a)
  }

  /** Transform a reference via an isomorphism

  Note: requires that for all s and t we have f(g(t)) = t and g(f(s)) = s */
  iso<T>(f: (s: S) => T, g: (t: T) => S): Ref<T> {
    return Ref.sub(
      this,
      () => f(this.get()),
      (t: T) => this.set(g(t))
    )
  }

  /** Make a derived reference */
  lens<T>(project: (s: S) => T, inject: (s: S, t: T) => S): Ref<T> {
    return this.iso(project, t => inject(this.get(), t))
  }

  /** Make a subreference with respect to some base reference */
  static sub<B, T>(base: Ref<B>, get: () => T, set: (s: T) => void): Ref<T> {
    return new Ref(
      base.transaction,
      base.listen,
      get,
      set
    )
  }

  /** Make the root reference */
  static init<S>(s0: S): Ref<S> {
    /** Current state */
    let s = s0
    /** Transaction depth, only notify when setting at depth 0 */
    let depth = 0
    /** Only notify on transactions that actually did set */
    let pending = false
    /** Listeners */
    const listeners = new ListWithRemove<() => void>()
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
    return new Ref(transaction, k => listeners.push(k), () => s, set)
  }

  /** Make a new reference from many in a record */
  static record<R>(refs: {[P in keyof R]: Ref<R[P]>}): Ref<R> {
    for (const base_key in refs) {
      const ref = refs[base_key]
      return Ref.sub(
        ref,
        () => {
          const ret = {} as R
          for (let k in refs) {
            ret[k] = refs[k].get()
          }
          return ret
        },
        (v: R) => {
          ref.transaction(() => {
            for (let k in refs) {
              refs[k].set(v[k])
            }
          })
        }
      )
    }
    throw "Empty record"
  }

  /** Make a reference to a particular index in an array */
  static index<A>(ref: Ref<A[]>, position: number): Ref<A | undefined> {
    return ref.lens(
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
            // fill with undefined:
            for (; ys.length < position; ys.push(undefined as any as A));
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

  /** Get references to each position currently in the array */
  static each<A>(ref: Ref<A[]>): Ref<A | undefined>[] {
    return ref.get().map((_, i) => Ref.index(ref, i))
  }


  /** Paginate a reference into equal pieces of a chunk size, which is either constant or calculated from the page index */
  static paginate<A>(ref: Ref<A[]>, chunk_size: number | ((i: number) => number)): Ref<A[][]> {
    return ref.iso(
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

class ListWithRemove<A> {
    private next_unique = 0
    private order = [] as (string[] | null)
    private dict = {} as Record<string, A>

    constructor() {}

    /** Push a new element, returns the delete function */
    public push(a: A): () => void {
      const id = this.next_unique++ + ''
      this.dict[id] = a
      if (this.order != null) {
        this.order.push(id)
      }
      return () => {
        delete this.dict[id]
        this.order = null
      }
    }

    /** Iterate over the elements */
    public iter(f: (a: A) => void): void {
      if (this.order == null) {
        const cmp = (a: string, b: string) => parseInt(a) - parseInt(b)
        this.order = Object.keys(this.dict).sort(cmp)
      }
      this.order.map(id => {
        if (id in this.dict) {
          f(this.dict[id])
        }
      })
    }
  }

