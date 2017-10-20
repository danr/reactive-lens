import { Ref, ref, record, views, at, glue, paginate } from './../src/Dannelib'
import * as test from "tape"

function reverse<A>(xs: A[]): A[] {
  return xs.slice().reverse()
}

test('Dannelib', assert => {
  let initial_state = {a: 1, b: [2, 3], c: {d: [3, 4], e: 4}}
  let initial_copy = {a: 1, b: [2, 3], c: {d: [3, 4], e: 4}}
  const r = ref(initial_state)
  let current: any
  let transaction_count = 0
  let oracle_count = 0
  r.on((x: any) => current = x)
  r.on((_: any) => transaction_count++)

  const after = (s: string, x: any, count = 1) => {
    assert.deepEqual(current, x, 'after ' + s)
    oracle_count += count
    assert.equal(transaction_count, oracle_count,
      count + ' new transaction' + (count > 1 ? 's' : ''))
  }

  const r_a = r.proj('a')
  const r_c_e = r.proj('c').proj('e')
  const r_a_and_c_e = record({a: r_a, e: r_c_e})

  r_a.set(999)
  after('set', {a: 999, b: [2, 3], c: {d: [3, 4], e: 4}})

  r_c_e.set(998)
  after('nested set', {a: 999, b: [2, 3], c: {d: [3, 4], e: 998}})

  r_a_and_c_e.set({a: 10, e: 20})
  after('record set', {a: 10, b: [2, 3], c: {d: [3, 4], e: 20}})

  const r_bs = r.proj('b')
  views(r_bs)[1].set(882)
  after('views set', {a: 10, b: [2, 882], c: {d: [3, 4], e: 20}})

  at(r_bs, 0).modify(x => x + 1)
  after('at modify', {a: 10, b: [3, 882], c: {d: [3, 4], e: 20}})

  views(glue(r_bs, r.proj('c').proj('d'))).map((r: Ref<number>) => r.modify(x => x + 1))
  after('glue', {a: 10, b: [4, 883], c: {d: [4, 5], e: 20}}, 4)

  at(r_bs.iso(reverse, reverse), 0).set(42)
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

  r.proj('b').set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  after('b setup', {a: 405, b: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], c: {d: [4, 5], e: 20}})

  const p = paginate(r.proj('b'), 3)
  at(p, 1).modify(xs => xs.map(x => -x))
  after('paginated modify', {a: 405, b: [1, 2, 3, -4, -5, -6, 7, 8, 9, 10, 11], c: {d: [4, 5], e: 20}})

  at(p, 3).modify(xs => xs.map(x => -x))
  after('paginated chopped modify', {a: 405, b: [1, 2, 3, -4, -5, -6, 7, 8, 9, -10, -11], c: {d: [4, 5], e: 20}})

  assert.end()
})


