
/** Reference to some state */
export interface Ref<S> extends BareRef<S> {
  /** Make a new reference by projecting a subfield.

  Note: use only when S is actually an object */
  proj<K extends keyof S>(k: K): Ref<S[K]>

  /** Invoke a function with a reference to a subfield.

  Note: use only when S is actually an object */
  proj$<K extends keyof S, R>(k: K, f: (ref: Ref<S[K]>) => R): R

  /** Start a new transaction: now you can use set and modify
  many times, and only when the (top-level) transaction is finished
  listeners will be notified
  */
  transaction: Transaction

  /** Modify the value in the reference

  Note: do not mutate it, return a new value */
  modify(f: (s: S) => S): void

  /** Transform a reference via an isomorphism

  Note: requires that for all s and t we have f(g(t)) = t and g(f(s)) = s
  */
  iso<T>(f: (s: S) => T, g: (t: T) => S): Ref<T>
}

type Transaction = (m: () => void) => void

interface BareRef<S> {
  /** Get the current value

  Note: do not mutate this value
  */
  get(): S
  /** Set to a new value */
  set(s: S): void
}

interface OnChange<S> {
  /** React on changes. returns an unsubscribe function */
  on(change: Change<S>): (() => void)
}

type Change<S> = ((s: S) => void)

/** Make a new reference which can have listeners given the initial state */
export function ref<S>(s0: S): Ref<S> & OnChange<S> {
  /** Current state */
  let s = s0
  /** Transaction depth, only notify when setting at depth 0 */
  let d = 0
  /** Only notify on transactions that actually did set */
  let pending = false
  /** Unique supply of identifiers */
  let us = 0
  /** Listeners */
  const listeners = {} as Record<string, Change<S>>
  /** Notify listeners if applicable */
  const notify = () => {
    if (d == 0 && pending) {
      pending = false
      Object.keys(listeners).map(id => listeners[id](s))
    }
  }
  return {
    on(k: Change<S>) {
      const id = us++
      listeners[id] = k
      return () => {
        delete listeners[id]
      }
    },
    ...bless(m => {
      d++
      m()
      d--
      notify()
    }, {
      get: () => s,
      set: (v: S) => {
        s = v
        pending = true
        notify()
      }
    }),
  }
}

/** Bless a bare reference with utility functions */
export function bless<R>(transaction: Transaction, ref: BareRef<R>): Ref<R> {
  return {
    ...ref,
    modify: f => ref.set(f(ref.get())),
    proj: k => proj_bare(transaction, ref, k),
    proj$: (k, f) => f(proj_bare(transaction, ref, k)),
    iso: (f, g) => bless(transaction, {
      get: () => f(ref.get()),
      set: v => ref.set(g(v))
    }),
    transaction,
  }
}

/** Project a key from a bare reference */
export function proj_bare<R, K extends keyof R>(transaction: Transaction, ref: BareRef<R>, k: K): Ref<R[K]> {
  return bless(transaction, {
    get: () => ref.get()[k],
    set: (v: R[K]) => ref.set({...ref.get() as any, [k as string]: v}),
  })
}

/** Project a key from a reference */
export function proj<R, K extends keyof R>(ref: Ref<R>, k: K): Ref<R[K]> {
  return proj_bare(ref.transaction, ref, k)
}


/** Make a new refence from many in a record */
export function record<R>(refs: {[P in keyof R]: Ref<R[P]>}): Ref<R> {
  for (const base_key in refs) {
    const transaction = refs[base_key].transaction
    return bless(transaction, {
      get: () => {
        const ret = {} as R
        for (let k in refs) {
          ret[k] = refs[k].get()
        }
        return ret
      },
      set: (v: R) => {
        transaction(() => {
          for (let k in refs) {
            refs[k].set(v[k])
          }
        })
      }
    })
  }
  throw "Empty record"
}

/** Make a reference to a particular index in an array */
export function at<A>(ref: Ref<A[]>, index: number): Ref<A> {
  return bless(ref.transaction, {
    get() {
      return ref.get()[index]
    },
    set(v) {
      const now = ref.get()
      if (index < now.length) {
        const a = now.slice(0, index)
        const z = now.slice(index + 1)
        ref.set([...a, v, ...z])
      }
    }
  })
}

/** Get references to all indexes in an array */
export function views<A>(ref: Ref<A[]>): Ref<A>[] {
  return ref.get().map((_, i) => at(ref, i))
}

/** Refer to two arrays after each other */
export function glue<A>(a: Ref<A[]>, b: Ref<A[]>): Ref<A[]> {
  return bless(a.transaction, {
    get: () => ([] as A[]).concat(a.get(), b.get()),
    set(v: A[]) {
      const al = a.get().length
      a.transaction(() => {
        a.set(v.slice(0, al))
        b.set(v.slice(al))
      })
    }
  })
}


/*
const r = ref({a: 1, b: [2, 3], c: {d: [3, 4], e: 4}})
r.on(x => console.log(x))
const ra = r.proj('a')
ra.set(999)
const re = r.proj('c').proj('e')
re.set(998)
const rae = record({a: ra, e: re})
rae.set({a: 10, e: 20})
const rbs = r.proj('b')

view(rbs)[1].set(882)
at(rbs, 0).modify(x => x + 1)

console.log('glue:')
view(glue(rbs, r.proj('c').proj('d'))).map(r => r.modify(x => x + 1))

export function reverse<A>(xs: A[]): A[] {
  return xs.slice().reverse()
}

console.log('iso:')

at(rbs.iso(reverse, reverse), 0).set(42)
*/
