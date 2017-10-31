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

## `class Store<S>`

Store for some state

Store laws (assuming no listeners):

```
s.set(a).get() = a

s.set(s.get()).get() = s.get()

s.set(a).set(b).get() = s.set(b).get()
```

Store laws with listeners:

```
s.transaction(() => s.set(a).get()) = a

s.transaction(() => s.set(s.get()).get()) = s.get()

s.transaction(() => s.set(a).set(b).get()) = s.set(b).get()
```

A store is a partially applied, existentially quantified lens with a change listener.

### `static init<S>(s0: S): Store<S>`

Make the root store

### `transaction<A>(m: () => A): A`

Start a new transaction: listeners are only invoked when the
(top-level) transaction finishes, and not on set (and modify) inside the transaction.

### `get(): S`

Get the current value (which must not be mutated)

### `set(s: S): Store<S>`

Set the value

Returns itself.

### `modify(f: (s: S) => S): Store<S>`

Modify the value in the store (must not use mutation: construct a new value)

Returns itself.

### `on(k: (s: S) => void): () => void`

React on changes. Returns an unsubscribe function.

### `zoom<T>(lens: Lens<S, T>): Store<T>`

Zoom in on a subpart of the store via a lens

### `at<K extends keyof S>(k: K): Store<S[K]>`

Make a substore at a key

Note: the key must always be present.

### `pick<Ks extends keyof S>(...ks: Ks[]): Store<{ [K in Ks]: S[K]; }>`

Make a substore by picking many keys

Note: the keys must always be present.

### `relabel<T>(lenses: { [K in keyof T]: Store<T[K]>; }): Store<T>`

Make a substore by relabelling

Note: must not use the same part of the store several times.

### `along<K extends keyof S, Ks extends keyof S, B>(k: K, i: Lens<S[K], B>, ...keep: Ks[]): Store<{ [k in K]: B; } & { [k in Ks]: S[k]; }>`

Apply a lens along one field, keep the rest of the shape intact

### `static readonly partial: { each<A>(store: Store<A[]>): Store<A>[]; };`

Partial substore makers

## `interface Lens<S, T>`

A simple lens

### `get(s: S): T`

Get the current value

### `set(s: S, t: T): S`

Set the current value

## `module Lens`

Utility functions on lenses

### `function lens<S, T>(get: (s: S) => T, set: (s: S, t: T) => S): Lens<S, T>`

Make a lens from a getter and setter

Note: lenses are subject to three lens laws

### `function relabel<S, T>(lenses: { [K in keyof T]: Lens<S, T[K]>; }): Lens<S, T>`

Lens from a record of lenses

Note: must not use the same part of the store several times.

### `function at<S, K extends keyof S>(k: K): Lens<S, S[K]>`

Lens to a key in a record

Note: the key must always be present.

### `function iso<S, T>(f: (s: S) => T, g: (t: T) => S): Lens<S, T>`

Make an isomorphism. Every isomorphism is a lens.

Note: requires that for all s and t we have f(g(t)) = t and g(f(s)) = s

### `function pick<S, Ks extends keyof S>(...keys: Ks[]): Lens<S, { [K in Ks]: S[K]; }>`

Lens to a keys in a record

Note: the keys must always be present.

### `function key<S, K extends keyof S>(k: K): Lens<S, S[K] | undefined>`

Lens to a key in a record which may be missing

Note: setting the value to undefined removes the key from the record.

### `function def<A>(missing: A): Lens<A | undefined, A>`

Lens which refer to a default value instead of undefined

### `function seq<S, T, U>(lens1: Lens<S, T>, lens2: Lens<T, U>): Lens<S, U>`

Compose two lenses sequentially

### `function arr<A, K extends keyof Array<A>>(store: Store<Array<A>>, k: K): Array<A>[K]`

Set using an array method (purity is ensured because the spine is copied before running the function)

### `function along<S>(type_hint?: Store<S> | (() => S)): <K extends keyof S, Ks extends keyof S, B>(k: K, i: Lens<S[K], B>, ...keep: Ks[]) => Lens<S, { [k in K]: B; } & { [k in Ks]: S[k]; }>`

Apply a lens along one field, keep the rest of the shape intact

## `module partial`

Partial lenses

### `function index<A>(i: number): Lens<A[], A>`

Partial lens to a particular index in an array

Note: an exception is thrown if you look outside the array.

## `interface Undo<S>`

History zipper



## `interface Stack<S>`

A non-empty stack



## `module Undo`

History zipper functions

Todo: document this without puns and semi-obscure references

### `function undo<S>(h: Undo<S>): Undo<S>`

Undo iff there is a past

### `function redo<S>(h: Undo<S>): Undo<S>`

Redo iff there is a future

### `function advance<S>(h: Undo<S>): Undo<S>`

Advances the history by copying the present

### `function init<S>(now: S): Undo<S>`

Make history

### `function now<S>(): Lens<Undo<S>, S>`

Lens to the present moment
