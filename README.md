# reactive-lens

> A lightweight library for pure, reactive and composable state.

## Synopsis

The `Store` in this library is a _reactive lens_: a partially applied, existentially quantified lens with a change listener.

```javascript
import { Store } from 'reactive-lens'

const increment = x => x + 1
const decrement = x => x - 1

const store = Store.init({left: 0, right: 0})

store.on(x => console.log(x))

store.at('left').modify(increment)
store.at('right').modify(increment)
store.at('left').modify(decrement)
```

Hooking it up with the DOM:

```typescript
import { Store } from 'reactive-lens'

const store = Store.init({left: '', right: ''})

function Input(store: Store<string>) {
  const input = document.createElement('input')
  input.value = store.get()
  store.on(x => input.value = x)
  input.addEventListener('input', function () { store.set(this.value) })
}

const body = document.getElementsByTagName('body')[0]
body.appendChild(Input(store.at('left')))
body.appendChild(Input(store.at('right')))
```

## API overview
* class Store
  * init
  * get
  * set
  * update
  * modify
  * on
  * ondiff
  * transaction
  * via
  * at
  * pick
  * omit
  * relabel
  * merge
  * arr
  * each
  * storage_connect
  * location_connect
* attach
* interface Lens
  * get
  * set
* module Lens
  * lens
  * relabel
  * at
  * iso
  * pick
  * key
  * def
  * seq
  * omit
  * index
* module Undo
  * undo
  * redo
  * advance
  * init
  * advance_to
  * can_undo
  * can_redo
* interface Undo
  * now
  * prev
  * next
* interface Stack
  * top
  * pop
* module Requests
  * request_maker
  * request
  * process_requests
* Diff
* Omit

## Documentation
### class Store

Store for some state

Store laws (assuming no listeners):

1. `s.set(a).get() = a`

2. `s.set(s.get()).get() = s.get()`

3. `s.set(a).set(b).get() = s.set(b).get()`

Store laws with listeners:

1. `s.transaction(() => s.set(a).get()) = a`

2. `s.transaction(() => s.set(s.get()).get()) = s.get()`

3. `s.transaction(() => s.set(a).set(b).get()) = s.set(b).get()`

A store is a partially applied, existentially quantified lens with a change listener.
* **init**: `<S>(s0: S) => Store<S>`

  Make the root store (static method) 
* **get**: `() => S`

  Get the current value (which must not be mutated)

  ```typescript
  const store = Store.init(1)
  store.get()
  // => 1
  ```
* **set**: `(s: S) => Store<S>`

  Set the value

  ```typescript
  const store = Store.init(1)
  store.set(2)
  store.get()
  // => 2
  ```

  Returns itself. 
* **update**: `<K extends keyof S>(parts: { [k in K]: S[K]; }) => Store<S>`

  Update some parts of the state, keep the rest constant

  ```typescript
  const store = Store.init({a: 1, b: 2})
  store.update({a: 3})
  store.get()
  // => {a: 3, b: 2}
  ```

  Returns itself. 
* **modify**: `(f: (s: S) => S) => Store<S>`

  Modify the value in the store (must not use mutation: construct a new value)

  ```typescript
  const store = Store.init(1)
  store.modify(x => x + 1)
  store.get()
  // => 2
  ```

  Returns itself. 
* **on**: `(k: (s: S) => void) => () => void`

  React on changes. Returns the unsubscribe function.

  ```typescript
  const store = Store.init(1)
  let last
  const off = store.on(x => last = x)
  store.set(2)
  last // => 2
  off()
  store.set(3)
  last // => 2
  ```
* **ondiff**: `(k: (new_value: S, old_value: S) => void) => () => void`

  React on a difference in value. Returns the unsubscribe function.

  ```typescript
    const store = Store.init({a: 0})
    let diffs = 0
    const off = store.ondiff((new_value, old) => {
      assert.notEqual(new_value, old)
      diffs++
    })
    diffs // => 0
    const object = {a: 1}
    store.set(object)            // diff: new object
    diffs                        // => 1
    store.set(object)            // no diff: same object
    diffs                        // => 1
    store.set({a: 2})            // diff: new object
    diffs                        // => 2
    store.set({a: 2})            // diff: this is yet another new literal object
    diffs                        // => 3
    store.set(store.get())       // no diff: same object
    diffs                        // => 3
    store.modify(x => x)         // no diff: same object
    diffs                        // => 3
    store.at('a').modify(x => x) // diff: at does not see if the value actually changed
    diffs                        // => 4
  ```

  Note: keeps a reference to the last value in memory. 
* **transaction**: `<A>(m: () => A) => A`

  Start a new transaction: listeners are only invoked when the
  (top-level) transaction finishes, and not on set (and modify) inside the transaction.

  ```typescript
  const store = Store.init(1)
  let last
  store.on(x => last = x)
  store.transaction(() => {
    store.set(2)
    assert.equal(last, undefined)
    return 3
  })   // => 3
  last // => 2
  ```
* **via**: `<T>(lens: Lens<S, T>) => Store<T>`

  Zoom in on a subpart of the store via a lens

  ```typescript
  const store = Store.init({a: 1, b: 2} as Record<string, number>)
  const a_store = store.via(Lens.key('a'))
  a_store.set(3)
  store.get() // => {a: 3, b: 2}
  a_store.get() // => 3
  a_store.set(undefined)
  store.get() // => {b: 2}
  ```
* **at**: `<K extends keyof S>(k: K) => Store<S[K]>`

  Make a substore at a key

  ```typescript
  const store = Store.init({a: 1, b: 2})
  store.at('a').set(3)
  store.get() // => {a: 3, b: 2}
  store.at('a').get() // => 3
  ```

  Note: the key must always be present. 
* **pick**: `<Ks extends keyof S>(...ks: Array<Ks>) => Store<{ [K in Ks]: S[K]; }>`

  Make a substore by picking many keys

  ```typescript
  const store = Store.init({a: 1, b: 2, c: 3})
  store.pick('a', 'b').get() // => {a: 1, b: 2}
  store.pick('a', 'b').set({a: 5, b: 4})
  store.get() // => {a: 5, b: 4, c: 3}
  ```

  Note: the keys must always be present. 
* **omit**: `<K extends keyof S>(...ks: Array<K>) => Store<Omit<S, K>>`

  Make a substore which omits some keys

  ```typescript
  const store = Store.init({a: 1, b: 2, c: 3, d: 4})
  const cd = store.omit('a', 'b')
  cd.get() // => {c: 3, d: 4}
  cd.set({c: 5, d: 6})
  store.get() // {a: 1, b: 2, c: 5, d: 6}
  ```
* **relabel**: `<T>(stores: { [K in keyof T]: Store<T[K]>; }) => Store<T>`

  Make a substore by relabelling

  ```typescript
  const store = Store.init({a: 1, b: 2, c: 3})
  const other = store.relabel({x: store.at('a'), y: store.at('b')})
  other.get() // => {x: 1, y: 2}
  other.set({x: 5, y: 4})
  store.get() // => {a: 5, b: 4, c: 3}
  ```

  Note: must not use the same part of the store several times. 
* **merge**: `<T>(other: Store<T>) => Store<S & T>`

  Merge two stores

  ```typescript
  const store = Store.init({a: 1, b: 2, c: 3})
  const small = store.pick('a')
  const other = small.merge(store.relabel({z: store.at('c')}))
  other.get() // => {a: 1, z: 3}
  other.set({a: 0, z: 4})
  store.get() // => {a: 0, b: 2, c: 4}
  ```

  Note: the two stores must originate from the same root.
  Note: this store and the other store must both be objects.
  Note: must not use the same part of the store several times. 
* **arr**: `<A, K extends "length" | "toString" | "toLocaleString" | "push" | "pop" | "concat" | "join" | "reverse" | "shift" | "slice" | "sort" | "splice" | "unshift" | "indexOf" | "lastIndexOf" | "every" | "some" | "forEach" | "map" | "filter" | "reduce" | "reduceRight">(store: Store<Array<A>>, k: K) => Array<A>[K]`

  Set the value using an array method (purity is ensured because the spine is copied before running the function)

  ```typescript
  const store = Store.init(['a', 'b', 'c', 'd'])
  Store.arr(store, 'splice')(1, 2, 'x', 'y', 'z') // => ['b', 'c']
  store.get() // => ['a', 'x', 'y', 'z', 'd']
  ```

  (static method) 
* **each**: `<A>(store: Store<Array<A>>) => Array<Store<A>>`

  Get partial stores for each position currently in the array

  ```typescript
  const store = Store.init(['a', 'b', 'c'])
  Store.each(store).map((substore, i) => substore.modify(s => s + i.toString()))
  store.get() // => ['a0', 'b1', 'c2']
  ```

  (static method)

  Note: exceptions are thrown when looking outside the array. 
* **storage_connect**: `(key?: string, audit?: (s: S) => boolean, api?: { get: (key: string) => string; set: (key: string, data: string) => void; }) => () => void`

  Connect with local storage 
* **location_connect**: `(to_hash: (state: S) => string, from_hash: (hash: string) => S, api?: { get(): string; set(hash: string): void; on(cb: () => void): void; }) => () => void`

  Connect with window.location.hash 
* **attach**: `<S, VDOM>(render: (vdom: VDOM) => void, init_state: S, setup_view: (store: Store<S>) => () => VDOM) => (setup_next_view: (store: Store<S>) => () => VDOM) => void`

  Attach a store with a virtual DOM, returning the reattach function for hot module reloading. 
### interface Lens

A lens: allows you to operate on a subpart `T` of some data `S`

Lenses must conform to these three lens laws:

`l.get(l.set(s, t)) = t`

`l.set(s, l.get(s)) = s`

`l.set(l.set(s, a), b) = l.set(s, b)`
* **get**: `(s: S) => T`

  Get the value via the lens 
* **set**: `(s: S, t: T) => S`

  Set the value via the lens 
### module Lens

Common lens constructors and functions 
* **lens**: `<S, T>(get: (s: S) => T, set: (s: S, t: T) => S) => Lens<S, T>`

  Make a lens from a getter and setter

  Note: lenses are subject to the three lens laws 
* **relabel**: `<S, T>(lenses: { [K in keyof T]: Lens<S, T[K]>; }) => Lens<S, T>`

  Lens from a record of lenses

  Note: must not use the same part of the store several times. 
* **at**: `<S, K extends keyof S>(k: K) => Lens<S, S[K]>`

  Lens to a key in a record

  Note: the key must always be present. 
* **iso**: `<S, T>(f: (s: S) => T, g: (t: T) => S) => Lens<S, T>`

  Make a lens from an isomorphism.

  ```typescript
  const store = Store.init(5)
  const doubled = store.via(Lens.iso(x => 2 * x, x => x / 2))
  doubled.get() // => 10
  doubled.set(50)
  store.get() // => 25
  doubled.modify(x => x * 2).get() // => 100
  store.get() // => 50
  ```

  Note: requires that for all `s` and `t` we have `f(g(t)) = t` and `g(f(s)) = s` 
* **pick**: `<S, Ks extends keyof S>(...keys: Array<Ks>) => Lens<S, { [K in Ks]: S[K]; }>`

  Lens to a keys in a record

  Note: the keys must always be present. 
* **key**: `<S, K extends keyof S>(k: K) => Lens<S, S[K]>`

  Lens to a key in a record which may be missing

  Note: setting the value to undefined removes the key from the record. 
* **def**: `<A>(missing: A) => Lens<A, A>`

  Lens which refer to a default value instead of undefined

  ```typescript
  const store = Store.init({a: 1, b: 2} as Record<string, number>)
  const a_store = store.via(Lens.key('a')).via(Lens.def(0))
  a_store.set(3)
  store.get() // => {a: 3, b: 2}
  a_store.get() // => 3
  a_store.set(0)
  store.get() // => {b: 2}
  a_store.modify(x => x + 1)
  store.get() // => {a: 1, b: 2}
  ```
* **seq**: `<S, T, U>(lens1: Lens<S, T>, lens2: Lens<T, U>) => Lens<S, U>`

  Compose two lenses sequentially 
* **omit**: `<S, K extends keyof S>(...ks: Array<K>) => Lens<S, Omit<S, K>>`

  Make a lens which omits some keys 
* **index**: `<A>(i: number) => Lens<Array<A>, A>`

  Partial lens to a particular index in an array

  ```typescript
  const store = Store.init([0, 1, 2, 3])
  const first = store.via(Lens.index(0))
  first.get() // => 0
  first.set(99)
  store.get() // => [99, 1, 2, 3]
  ```

  Note: an exception is thrown if you look outside the array. 
### module Undo

History zipper functions

```typescript
const {undo, redo, advance, advance_to} = Undo
const store = Store.init(Undo.init({a: 1, b: 2}))
const modify = op => store.modify(op)
const now = store.at('now')
now.get() // => {a: 1, b: 2}
modify(advance_to({a: 3, b: 4}))
now.get() // => {a: 3, b: 4}
modify(undo)
now.get() // => {a: 1, b: 2}
modify(redo)
now.get() // => {a: 3, b: 4}
modify(advance)
now.update({a: 5})
now.get() // => {a: 5, b: 4}
modify(undo)
now.get() // => {a: 3, b: 4}
modify(undo)
now.get() // => {a: 1, b: 2}
modify(undo)
now.get() // => {a: 1, b: 2}
```
* **undo**: `<S>(h: Undo<S>) => Undo<S>`

  Undo iff there is a past 
* **redo**: `<S>(h: Undo<S>) => Undo<S>`

  Redo iff there is a future 
* **advance**: `<S>(h: Undo<S>) => Undo<S>`

  Advances the history by copying the present state 
* **init**: `<S>(now: S) => Undo<S>`

  Initialise the history 
* **advance_to**: `<S>(s: S) => (h: Undo<S>) => Undo<S>`

  Advances the history to some new state 
* **can_undo**: `<S>(h: Undo<S>) => boolean`

  Is there a state to undo to? 
* **can_redo**: `<S>(h: Undo<S>) => boolean`

  Is there a state to redo to? 
### interface Undo

History zipper 
* **now**: `S`

  
* **prev**: `Stack<S>`

  
* **next**: `Stack<S>`

  
### interface Stack

A non-empty stack 
* **top**: `S`

  
* **pop**: `Stack<S>`

  
### module Requests

Utility functions to make Elm/Redux-style requests

A queue of requests are maintained in an array.

TODO: Document and test. 
* **request_maker**: `<R>(store: Store<Array<R>>) => (request: R) => void`

  Make a function for making requests 
* **request**: `<R>(store: Store<Array<R>>, request: R) => void`

  Make a request 
* **process_requests**: `<R>(store: Store<Array<R>>, process: (request: R) => void) => () => void`

  Process requests, one at a time

  Retuns the off function. 
* **Diff**: `undefined`

  
* **Omit**: `undefined`

  
