# reactive-lens

> A tiny library for pure, reactive and composable state.

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

## Documentation

## API overview
* class Store
  * init
  * get
  * set
  * update
  * modify
  * on
  * transaction
  * zoom
  * at
  * pick
  * relabel
  * along
  * arr
  * each
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
  * index
* module Undo
  * undo
  * redo
  * advance
  * init
  * now
* interface Undo
  * tip
  * next
* interface Stack
  * top
  * pop
### class Store

Store for some state

Store laws (assuming no listeners):

`s.set(a).get() = a`

`s.set(s.get()).get() = s.get()`

`s.set(a).set(b).get() = s.set(b).get()`

Store laws with listeners:

`s.transaction(() => s.set(a).get()) = a`

`s.transaction(() => s.set(s.get()).get()) = s.get()`

`s.transaction(() => s.set(a).set(b).get()) = s.set(b).get()`

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

  React on changes. Returns an unsubscribe function.

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
* **transaction**: `<A>(m: () => A) => A`

  Start a new transaction: listeners are only invoked when the
  (top-level) transaction finishes, and not on set (and modify) inside the transaction.

  ```typescript
  const store = Store.init(1)
  let last
  let middle
  store.on(x => last = x)
  store.transaction(() => {
    store.set(2)
    assert.equal(last, undefined)
    return 3
  })   // => 3
  last // => 2
  ```
* **zoom**: `<T>(lens: Lens<S, T>) => Store<T>`

  Zoom in on a subpart of the store via a lens
* **at**: `<K extends keyof S>(k: K) => Store<S[K]>`

  Make a substore at a key

  Note: the key must always be present.
* **pick**: `<Ks extends keyof S>(...ks: Array<Ks>) => Store<{ [K in Ks]: S[K]; }>`

  Make a substore by picking many keys

  Note: the keys must always be present.
* **relabel**: `<T>(stores: { [K in keyof T]: Store<T[K]>; }) => Store<T>`

  Make a substore by relabelling

  Note: must not use the same part of the store several times.
* **along**: `<K extends keyof S, Ks extends keyof S, B>(k: K, s: Store<B>, ...keep: Array<Ks>) => Store<{ [k in K]: B; } & { [k in Ks]: S[k]; }>`

  Replace the substore at one field and keep the rest of the shape intact

  Note: must not use the same part of the store several times.
* **arr**: `<A, K extends "length" | "toString" | "toLocaleString" | "push" | "pop" | "concat" | "join" | "reverse" | "shift" | "slice" | "sort" | "splice" | "unshift" | "indexOf" | "lastIndexOf" | "every" | "some" | "forEach" | "map" | "filter" | "reduce" | "reduceRight">(store: Store<Array<A>>, k: K) => Array<A>[K]`

  Set the value using an array method (purity is ensured because the spine is copied before running the function)

  (static method)
* **each**: `<A>(store: Store<Array<A>>) => Array<Store<A>>`

  Get partial stores for each position currently in the array

  (static method)

  Note: exceptions are thrown when looking outside the array.
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

  Note: requires that for all `s` and `t` we have `f(g(t)) = t` and `g(f(s)) = s`
* **pick**: `<S, Ks extends keyof S>(...keys: Array<Ks>) => Lens<S, { [K in Ks]: S[K]; }>`

  Lens to a keys in a record

  Note: the keys must always be present.
* **key**: `<S, K extends keyof S>(k: K) => Lens<S, S[K]>`

  Lens to a key in a record which may be missing

  Note: setting the value to undefined removes the key from the record.
* **def**: `<A>(missing: A) => Lens<A, A>`

  Lens which refer to a default value instead of undefined
* **seq**: `<S, T, U>(lens1: Lens<S, T>, lens2: Lens<T, U>) => Lens<S, U>`

  Compose two lenses sequentially
* **index**: `<A>(i: number) => Lens<Array<A>, A>`

  Partial lens to a particular index in an array

  Note: an exception is thrown if you look outside the array.
### module Undo

History zipper functions

Todo: document this without puns and semi-obscure references
* **undo**: `<S>(h: Undo<S>) => Undo<S>`

  Undo iff there is a past
* **redo**: `<S>(h: Undo<S>) => Undo<S>`

  Redo iff there is a future
* **advance**: `<S>(h: Undo<S>) => Undo<S>`

  Advances the history by copying the present
* **init**: `<S>(now: S) => Undo<S>`

  Make history
* **now**: `<S>() => Lens<Undo<S>, S>`

  Lens to the present moment
### interface Undo

History zipper
* **tip**: `Stack<S>`

  
* **next**: `Stack<S>`

  
### interface Stack

A non-empty stack
* **top**: `S`

  
* **pop**: `Stack<S>`

  
