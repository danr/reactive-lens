import { Ref } from './../src/projective'
import * as test from "tape"

function reverse<A>(xs: A[]): A[] {
  return xs.slice().reverse()
}

/** Refer to two arrays after each other */
function glue<A>(a: Ref<A[]>, b: Ref<A[]>): Ref<A[]> {
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

function init<S>(s0: S, assert: test.Test): {ref: Ref<S>, after(s: string, x: any, count?: number): void} {
  const ref = Ref.init(s0)
  let current = ref.get()
  let transaction_count = 0
  let oracle_count = 0
  ref.on(x => {
    current = x
    transaction_count++
  })
  return {
    ref,
    after: (s, x, count=1) => {
      assert.deepEqual(current, x, 'after ' + s)
      oracle_count += count
      assert.equal(transaction_count, oracle_count,
        count + ' new transaction' + (count > 1 ? 's' : ''))
    }
  }
}

test('projective', assert => {
  let initial_state = {a: 1, b: [2, 3], c: {d: [3, 4], e: 4}}
  let initial_copy = {a: 1, b: [2, 3], c: {d: [3, 4], e: 4}}
  const {ref, after} = init(initial_state, assert)

  const r_a = ref.at('a')
  const r_c_e = ref.at('c').at('e')
  const r_a_and_c_e = Ref.record({a: r_a, e: r_c_e})

  r_a.set(999)
  after('set', {a: 999, b: [2, 3], c: {d: [3, 4], e: 4}})

  r_c_e.set(998)
  after('nested set', {a: 999, b: [2, 3], c: {d: [3, 4], e: 998}})

  assert.assert([r_a_and_c_e.at('a').get(), r_a_and_c_e.get()['a']].every(x => x == 999))
  r_a_and_c_e.set({a: 10, e: 20})
  assert.assert([r_a_and_c_e.at('a').get(), r_a_and_c_e.get()['a']].every(x => x == 10))
  after('record set', {a: 10, b: [2, 3], c: {d: [3, 4], e: 20}})

  const r_bs = ref.at('b')
  Ref.each(r_bs)[1].set(882)
  after('each set', {a: 10, b: [2, 882], c: {d: [3, 4], e: 20}})

  Ref.def(Ref.index(r_bs, 0), 0).modify(x => x + 1)
  after('index modify', {a: 10, b: [3, 882], c: {d: [3, 4], e: 20}})

  Ref.each(glue(r_bs, ref.at('c').at('d'))).map(r => Ref.def(r, 0).modify(x => x + 1))
  after('glue', {a: 10, b: [4, 883], c: {d: [4, 5], e: 20}}, 4)

  Ref.index(r_bs.iso(reverse, reverse), 0).set(42)
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

test('array removal', assert => {
  const {ref, after} = init([0,1,2], assert)
  Ref.index(ref, 1).set(undefined)
  after('removing 1', [0,2])
  Ref.def(Ref.index(ref, 1), 0).set(0)
  after('removing 2 via def', [0])
  assert.end()
})

test('array insertion', assert => {
  const {ref, after} = init([0,1,2], assert)
  Ref.index(ref, 3).set(3)
  after('inserting 3', [0,1,2,3])
  Ref.def(Ref.index(ref, 4), 0).set(4)
  after('inserting 4 with def', [0,1,2,3,4])
  assert.end()
})

test('array insertion far out', assert => {
  const {ref, after} = init([0,1,2], assert)
  const r4 = Ref.index(ref, 4)
  r4.set(4)
  after('inserting 4', [0,1,2,void 0,4])
  r4.set(undefined)
  after('removing 4', [0,1,2])
  assert.end()
})

test('key', assert => {
  const {ref, after} = init({apa: 1, bepa: 2} as Record<string, number>, assert)
  const apa = ref.key('apa')
  const bepa = ref.key('bepa')
  const cepa = ref.key('cepa')
  apa.set(3)
  after('setting apa', {apa: 3, bepa: 2})
  apa.set(undefined)
  after('removing apa', {bepa: 2})
  Ref.def(bepa, 0).set(0)
  after('removing bepa via def', {})
  Ref.def(cepa, 0).set(3)
  after('inserting cepa via def', {cepa: 3})
  assert.is(cepa.get(), 3, 'get')
  assert.is(apa.get(), undefined, 'get missing')
  assert.end()
})

test('paginate', assert => {
  const {ref, after} = init([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], assert)

  const p = Ref.paginate(ref, 3)
  Ref.def(Ref.index(p, 1), []).modify(xs => xs.map(x => -x))
  after('paginated modify', [1, 2, 3, -4, -5, -6, 7, 8, 9, 10, 11])

  Ref.def(Ref.index(p, 3), []).modify(xs => xs.map(x => -x))
  after('paginated chopped modify', [1, 2, 3, -4, -5, -6, 7, 8, 9, -10, -11])

  Ref.def(Ref.index(p, 1), []).modify(xs => [])
  after('paginated remove', [1, 2, 3, 7, 8, 9, -10, -11])

  ref.transaction(() => {
    Ref.each(Ref.def(Ref.index(p, 1), [])).map(r => r.modify(x => x === undefined || x > 8 ? undefined : x))
  })
  after('paginated filtering', [1, 2, 3, 7, 8, -10, -11])

  ref.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.deepEqual(
    Ref.paginate(ref, i => i).get(),
    [[], [0], [1, 2], [3, 4, 5], [6, 7, 8, 9]],
    'triangulate'
  )

  assert.end()
})
