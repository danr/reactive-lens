
type Transaction = (m: () => void) => void

type OnChange = (k: Change) => () => void

type Change = () => void

/** Storing state */
export class Ref<S> {
  private constructor(
    /** Start a new transaction: allows using set and modify many times,
    and only when the (top-level) transaction is finished listeners will be
    notified. */
    public readonly transaction: Transaction,

    /** React on changes. returns an unsubscribe function */
    public readonly listen: OnChange,

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

  Note: use only when S is actually an object */
  proj<K extends keyof S>(k: K): Ref<S[K]> {
    return Ref.sub(
      this,
      () => this.get()[k],
      (v: S[K]) => this.set({...this.get() as any, [k as string]: v}),
    )
  }

  /** Invoke a function with a reference to a subfield.

  Note: use only when S is actually an object */
  proj$<K extends keyof S, A>(k: K, f: (s: Ref<S[K]>) => A) {
    return f(this.proj(k))
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
  static root<S>(s0: S): Ref<S> {
    /** Current state */
    let s = s0
    /** Transaction depth, only notify when setting at depth 0 */
    let d = 0
    /** Only notify on transactions that actually did set */
    let pending = false
    /** Unique supply of identifiers */
    let us = 0
    /** Listeners */
    const listeners = {} as Record<string, Change>
    /** Notify listeners if applicable */
    const notify = () => {
      if (d == 0 && pending) {
        pending = false
        Object.keys(listeners).map(id => {
          listeners[id]()
        })
      }
    }
    return new Ref(
      m => {
        d++
        m()
        d--
        notify()
      },
      (k: Change) => {
        const id = us++
        listeners[id] = k
        return () => {
          delete listeners[id]
        }
      },
      () => s,
      (v: S) => {
          s = v
          pending = true
          notify()
        }
      )
  }

}

/** Make a new refence from many in a record */
export function record<R>(refs: {[P in keyof R]: Ref<R[P]>}): Ref<R> {
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
export function at<A>(ref: Ref<A[]>, index: number): Ref<A> {
  return Ref.sub(
    ref,
    () => ref.get()[index],
    (v) => {
      const now = ref.get()
      if (index < now.length) {
        const a = now.slice(0, index)
        const z = now.slice(index + 1)
        ref.set([...a, v, ...z])
      }
    }
  )
}

/** Get references to all indexes in an array */
export function views<A>(ref: Ref<A[]>): Ref<A>[] {
  return ref.get().map((_, i) => at(ref, i))
}

/** Refer to two arrays after each other */
export function glue<A>(a: Ref<A[]>, b: Ref<A[]>): Ref<A[]> {
  return Ref.sub(
    a,
    () => ([] as A[]).concat(a.get(), b.get()),
    (v: A[]) => {
      const al = a.get().length
      a.transaction(() => {
        a.set(v.slice(0, al))
        b.set(v.slice(al))
      })
    }
  )
}

/** Helper function to paginate */
export function chunk<A>(xs: A[], chunk_size: number): A[][] {
  const out = [] as A[][]
  for (let i = 0; i < xs.length; i += chunk_size) {
    out.push(xs.slice(i, i + chunk_size))
  }
  return out
}

/** Paginate a reference into equal pieces of a chunk size */
export function paginate<A>(r: Ref<A[]>, chunk_size: number): Ref<A[][]> {
  return r.iso(
    xs => chunk(xs, chunk_size),
    xss => ([] as A[]).concat(...xss)
  )
}

