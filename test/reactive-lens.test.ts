import { Store, Store as L } from './../src/reactive-lens'
import * as test from "tape"

function reverse<A>(xs: A[]): A[] {
  return xs.slice().reverse()
}

/** Refer to two arrays after each other */
function glue<A>(a: Store<A[]>, b: Store<A[]>): Store<A[]> {
  return a.substore(
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

function init<S>(s0: S, assert: test.Test): {store: Store<S>, after(s: string, x: any, count?: number): void} {
  const store = Store.init(s0)
  let current = store.get()
  let transaction_count = 0
  let oracle_count = 0
  store.on(x => {
    current = x
    transaction_count++
  })
  return {
    store,
    after: (s, x, count=1) => {
      assert.deepEqual(current, x, 'after ' + s)
      oracle_count += count
      assert.equal(transaction_count, oracle_count,
        count + ' new transaction' + (count > 1 ? 's' : ''))
    }
  }
}

test('reactive-lens', assert => {
  let initial_state = {a: 1, b: [2, 3], c: {d: [3, 4], e: 4}}
  let initial_copy = {a: 1, b: [2, 3], c: {d: [3, 4], e: 4}}
  const {store, after} = init(initial_state, assert)

  const r_a = store.at('a')
  const r_c_e = store.at('c').at('e')
  const r_a_and_c_e = L.record({a: r_a, e: r_c_e})

  r_a.set(999)
  after('set', {a: 999, b: [2, 3], c: {d: [3, 4], e: 4}})

  r_c_e.set(998)
  after('nested set', {a: 999, b: [2, 3], c: {d: [3, 4], e: 998}})

  assert.assert([r_a_and_c_e.at('a').get(), r_a_and_c_e.get()['a']].every(x => x == 999))
  r_a_and_c_e.set({a: 10, e: 20})
  assert.assert([r_a_and_c_e.at('a').get(), r_a_and_c_e.get()['a']].every(x => x == 10))
  after('record set', {a: 10, b: [2, 3], c: {d: [3, 4], e: 20}})

  const r_bs = store.at('b')
  L.each(r_bs)[1].set(882)
  after('each set', {a: 10, b: [2, 882], c: {d: [3, 4], e: 20}})

  r_bs.via(L.index(0)).modify(x => x + 1)
  after('index modify', {a: 10, b: [3, 882], c: {d: [3, 4], e: 20}})

  L.each(glue(r_bs, store.at('c').at('d'))).map(r => r.modify(x => x + 1))
  after('glue', {a: 10, b: [4, 883], c: {d: [4, 5], e: 20}}, 4)

  r_bs.via(L.iso(reverse, reverse)).via(L.index(0)).set(42)
  after('iso reverse', {a: 10, b: [4, 42], c: {d: [4, 5], e: 20}})

  let a: any
  const unsubscribe = r_a.on(v => a = v)
  r_a.set(404)
  after('set', {a: 404, b: [4, 42], c: {d: [4, 5], e: 20}})
  assert.equal(a, 404, 'intercepted on')

  unsubscribe()

  r_a.set(405)
  after('set', {a: 405, b: [4, 42], c: {d: [4, 5], e: 20}})
  assert.equal(a, 404, 'not intercepted on after unsubscribe')

  assert.deepEqual(initial_state, initial_copy, 'original state unchanged')

  assert.end()
})

test('index', assert => {
  const {store, after} = init([0,1,2,10], assert)
  store.via(L.index(3)).set(3)
  after('inserting 3', [0,1,2,3])
  assert.end()
})

test('index out of bounds', assert => {
  const {store} = init([0,1,2], assert)
  const r4 = store.via(L.index(4))
  assert.throws(() => {
    r4.set(4)
  })
  const rn = store.via(L.index(-1))
  assert.throws(() => {
    rn.set(4)
  })
  assert.end()
})

test('key', assert => {
  const {store, after} = init({apa: 1, bepa: 2} as Record<string, number>, assert)
  const apa = store.key('apa')
  const bepa = store.key('bepa')
  const cepa = store.key('cepa')
  apa.set(3)
  after('setting apa', {apa: 3, bepa: 2})
  apa.set(undefined)
  after('removing apa', {bepa: 2})
  bepa.via(L.def(0)).set(0)
  after('removing bepa via def', {})
  cepa.via(L.def(0)).set(3)
  after('inserting cepa via def', {cepa: 3})
  assert.is(cepa.get(), 3, 'get')
  assert.is(apa.get(), undefined, 'get missing')
  assert.end()
})

test('arr', assert => {
  const {store, after} = init([0,1,2,3,4], assert)
  assert.deepEqual(L.arr(store, 'splice')(1,3,9,10), [1,2,3], 'return value')
  after('splicing', [0,9,10,4])
  assert.end()
})

