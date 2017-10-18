
export interface Ref<S> extends BareRef<S> {
  proj<K extends keyof S>(k: K): Ref<S[K]>
  transaction: Transaction
  modify(f: (s: S) => S): void
  iso<T>(f: (s: S) => T, g: (t: T) => S): Ref<T>
}

type Transaction = (m: () => void) => void

interface BareRef<S> {
  get(): S
  set(s: S): void
}

interface OnChange<S> {
  on(change: Change<S>): void
}

type Change<S> = ((s: S) => void)

export function ref<S>(s0: S): Ref<S> & OnChange<S> {
  let s = s0
  let d = 0
  const listeners = [] as Change<S>[]
  function notify() {
    if (d == 0) {
      listeners.map(k => k(s))
    }
  }
  return {
    on(k: Change<S>) {
      listeners.push(k)
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
        notify()
      }
    }),
  }
}

export function bless<R>(transaction: Transaction, ref: BareRef<R>): Ref<R> {
  return {
    ...ref,
    modify: f => ref.set(f(ref.get())),
    proj: k => proj(transaction, ref, k),
    iso: (f, g) => bless(transaction, {
      get: () => f(ref.get()),
      set: v => ref.set(g(v))
    }),
    transaction,
  }
}

export function proj<R, K extends keyof R>(transaction: Transaction, ref: BareRef<R>, k: K): Ref<R[K]> {
  return bless(transaction, {
    get: () => ref.get()[k],
    set: (v: R[K]) => ref.set({...ref.get() as any, [k as string]: v}),
  })
}

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

export function views<A>(ref: Ref<A[]>): Ref<A>[] {
  return ref.get().map((_, i) => at(ref, i))
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
