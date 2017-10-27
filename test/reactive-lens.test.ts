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

function check_laws<S>(s: Store<S>, a: S, b: S, assert: test.Test): void {
  const now = s.get()
  assert.deepEqual(s.transaction(() => s.set(a).get()), a, 'get after set')
  assert.deepEqual(s.transaction(() => s.set(s.get()).get()), s.get(), 'set after get')
  assert.deepEqual(s.transaction(() => s.set(a).set(b).get()), s.set(b).get(), 'set set')
  s.set(now)
}

function init<S>(s0: S, assert: test.Test): {store: Store<S>, after(s: string, x: any, count?: number): void, test_laws<T>(s: Store<T>, a: T, b: T): void} {
  const store = Store.init(s0)
  let current = store.get()
  let transaction_count = 0
  let oracle_count = 0
  store.on(x => {
    current = x
    transaction_count++
  })
  const after = (s: string, x: S, count=1) => {
    assert.deepEqual(current, x, 'after ' + s)
    oracle_count += count
    assert.equal(transaction_count, oracle_count,
      count + ' new transaction' + (count > 1 ? 's' : ''))
  }
  return {
    store,
    after,
    test_laws(s, a, b) {
      const orig = store.get()
      check_laws(s, a, b, assert)
      after('checking laws', orig, 5)
    }
  }
}

test('reactive-lens', assert => {
  let initial_state = {a: 1, b: [2, 3], c: {d: [3, 4], e: 4}}
  let initial_copy = {a: 1, b: [2, 3], c: {d: [3, 4], e: 4}}
  const {store, after, test_laws} = init(initial_state, assert)

  const r_a = store.at('a')
  const r_c_e = store.at('c').at('e')
  const r_a_and_c_e = L.record({a: r_a, e: r_c_e})

  r_a.set(999)
  after('set', {a: 999, b: [2, 3], c: {d: [3, 4], e: 4}})
  test_laws(r_a, 5, 6)

  r_c_e.set(998)
  after('nested set', {a: 999, b: [2, 3], c: {d: [3, 4], e: 998}})
  test_laws(r_c_e, 5, 6)

  assert.assert([r_a_and_c_e.at('a').get(), r_a_and_c_e.get()['a']].every(x => x == 999))
  r_a_and_c_e.set({a: 10, e: 20})
  assert.assert([r_a_and_c_e.at('a').get(), r_a_and_c_e.get()['a']].every(x => x == 10))
  after('record set', {a: 10, b: [2, 3], c: {d: [3, 4], e: 20}})
  test_laws(r_a_and_c_e, {a:1, e:2}, {a:2, e:1})

  const r_bs = store.at('b')
  L.each(r_bs)[1].set(882)
  after('each set', {a: 10, b: [2, 882], c: {d: [3, 4], e: 20}})

  r_bs.via(L.index(0)).modify(x => x + 1)
  after('index modify', {a: 10, b: [3, 882], c: {d: [3, 4], e: 20}})
  test_laws(r_bs, [9,8], [6,9,8])
  test_laws(r_bs.via(L.index(1)), 10, 20)

  L.each(glue(r_bs, store.at('c').at('d'))).map(r => r.modify(x => x + 1))
  after('glue', {a: 10, b: [4, 883], c: {d: [4, 5], e: 20}}, 4)

  const r_bsr = r_bs.via(L.iso(reverse, reverse))
  r_bsr.via(L.index(0)).set(42)
  after('iso reverse', {a: 10, b: [4, 42], c: {d: [4, 5], e: 20}})
  test_laws(r_bsr, [9,8], [6,9,8])
  test_laws(r_bsr.via(L.index(1)), 10, 20)

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
  const {store, after, test_laws} = init({apa: 1, bepa: 2} as Record<string, number>, assert)
  const apa = store.key('apa')
  const bepa = store.key('bepa')
  const cepa = store.key('cepa')
  apa.set(3)
  after('setting apa', {apa: 3, bepa: 2})
  test_laws(apa, 9, 8)
  apa.set(undefined)
  after('removing apa', {bepa: 2})
  test_laws(apa, 9, 8)
  test_laws(apa, undefined, 8)
  test_laws(apa, 8, undefined)
  const b0 = bepa.via(L.def(0))
  b0.set(0)
  after('removing bepa via def', {})
  test_laws(b0, 9, 8)
  test_laws(b0, 0, 8)
  test_laws(b0, 8, 0)
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

