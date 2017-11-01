import { Store, Lens as L } from './../src/reactive-lens'
import * as test from "tape"

function reverse<A>(xs: A[]): A[] {
  return xs.slice().reverse()
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
  const r_a_and_c_e = store.relabel({ a: r_a, e: r_c_e })

  const rab = store.pick('a', 'b')
  assert.deepEqual(rab.get(), {a: 1, b: [2, 3]})

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
  Store.partial.each(r_bs)[1].set(882)
  after('each set', {a: 10, b: [2, 882], c: {d: [3, 4], e: 20}})

  r_bs.zoom(L.partial.index(0)).modify(x => x + 1)
  after('index modify', {a: 10, b: [3, 882], c: {d: [3, 4], e: 20}})
  test_laws(r_bs, [9,8], [6,9,8])
  test_laws(r_bs.zoom(L.partial.index(1)), 10, 20)

  r_bs.modify(xs => xs.map(x => x + 1))
  store.at('c').at('d').modify(xs => xs.map(x => x + 1))
  after('mapping', {a: 10, b: [4, 883], c: {d: [4, 5], e: 20}}, 2)

  const r_bsr = r_bs.zoom(L.iso(reverse, reverse))
  r_bsr.zoom(L.partial.index(0)).set(42)
  after('iso reverse', {a: 10, b: [4, 42], c: {d: [4, 5], e: 20}})
  test_laws(r_bsr, [9,8], [6,9,8])
  test_laws(r_bsr.zoom(L.partial.index(1)), 10, 20)

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
  store.zoom(L.partial.index(3)).set(3)
  after('inserting 3', [0,1,2,3])
  assert.end()
})

test('index out of bounds', assert => {
  const {store} = init([0,1,2], assert)
  const r4 = store.zoom(L.partial.index(4))
  assert.throws(() => {
    r4.set(4)
  })
  const rn = store.zoom(L.partial.index(-1))
  assert.throws(() => {
    rn.set(4)
  })
  assert.end()
})

test('key', assert => {
  const {store, after, test_laws} = init({apa: 1, bepa: 2} as Record<string, number>, assert)
  const apa = store.zoom(L.key('apa'))
  const bepa = store.zoom(L.key('bepa'))
  const cepa = store.zoom(L.key('cepa'))
  apa.set(3)
  after('setting apa', {apa: 3, bepa: 2})
  test_laws(apa, 9, 8)
  apa.set(undefined)
  after('removing apa', {bepa: 2})
  test_laws(apa, 9, 8)
  test_laws(apa, undefined, 8)
  test_laws(apa, 8, undefined)
  const b0 = bepa.zoom(L.def(0))
  b0.set(0)
  after('removing bepa zoom def', {})
  test_laws(b0, 9, 8)
  test_laws(b0, 0, 8)
  test_laws(b0, 8, 0)
  cepa.zoom(L.def(0)).set(3)
  after('inserting cepa zoom def', {cepa: 3})
  assert.is(cepa.get(), 3, 'get')
  assert.is(apa.get(), undefined, 'get missing')
  assert.end()
})

test('arr', assert => {
  const {store, after} = init([0,1,2,3,4], assert)
  assert.deepEqual(Store.arr(store, 'splice')(1,3,9,10), [1,2,3], 'return value')
  after('splicing', [0,9,10,4])
  assert.end()
})

test('along', assert => {
  const s0 = {k: {a: 1, b: 2}, g: 3}
  const {store, after, test_laws} = init(s0, assert)
  const kag = store.along('k', store.at('k').at('a'), 'g')
  kag.set({k: 10, g: 30})
  after('along', {k: {a: 10, b: 2}, g: 30})
  test_laws(kag, {k: 9, g: 8}, {k: 7, g: 6})
  /*
  const kbg = store.zoom(L.along<typeof s0>()('k', L.at<typeof s0.k, 'b'>('b'), 'g'))
  kbg.set({k: 20, g: 40})
  after('zoom along', {k: {a: 10, b: 20}, g: 40})
  */
  test_laws(kag, {k: 9, g: 8}, {k: 7, g: 6})
  assert.end()
})

test('along along', assert => {
  const s0 = {k: {a: {u: 1, v: 2}, b: 3}, g: 4}
  const {store, after, test_laws} = init(s0, assert)
  const kag = store.along('k', store.at('k').along('a', store.at('k').at('a').at('u'), 'b'), 'g')
  kag.set({k: {a: 10, b: 30}, g: 40})
  after('along', {k: {a: {u: 10, v: 2}, b: 30}, g: 40})
  test_laws(kag, {k: {a: 9, b: 8}, g: 7}, {k: {a: 6, b: 5}, g: 4})
  assert.end()
})

test('relabel', assert => {
  const s0 = {k: 1, g: 2}
  const {store, after, test_laws} = init(s0, assert)
  const ab = store.zoom(L.relabel({a: L.at<typeof s0, 'g'>('g'), b: L.at<typeof s0, 'k'>('k')}))
  ab.set({a: 4, b: 3})
  after('relabel', {k: 3, g: 4})
  test_laws(ab, {a: 9, b: 8}, {a: 6, b: 5})
  assert.end()
})

test('pick', assert => {
  const s0 = {k: 1, g: 2, h: 3}
  const {store, after, test_laws} = init(s0, assert)
  const kg = store.pick('k', 'g')
  kg.set({k: 4, g: 5})
  after('pick', {k: 4, g: 5, h: 3})
  test_laws(kg, {k: 9, g: 8}, {k: 6, g: 5})
  const gh = store.zoom(L.pick('g', 'h'))
  gh.set({g: 6, h: 7})
  after('pick', {k: 4, g: 6, h: 7})
  test_laws(gh, {g: 8, h: 9}, {g: 5, h: 6})
  assert.end()
})

test('seq', assert => {
  const {store, after, test_laws} = init(1, assert)
  const double = L.iso((x: number) => x * 2, x => x / 2)
  const bump = L.iso((x: number) => x + 1, x => x - 1)
  const db = store.zoom(L.seq(double, bump))
  assert.equals(db.get(), 3)
  db.modify(x => x + 2)
  assert.equals(db.get(), 5)
  after('db modify', 2)
  test_laws(db, 8, 9)
  const bd = store.zoom(L.seq(bump, double))
  assert.equals(bd.get(), 6)
  bd.modify(x => x + 2)
  after('bd modify', 3)
  assert.end()
})

