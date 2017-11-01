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

### class Store\<S>

Store for some state

Store laws (assuming no listeners):

* `s.set(a).get() = a`

* `s.set(s.get()).get() = s.get()`

* `s.set(a).set(b).get() = s.set(b).get()`

Store laws with listeners:

* `s.transaction(() => s.set(a).get()) = a`

* `s.transaction(() => s.set(s.get()).get()) = s.get()`

* `s.transaction(() => s.set(a).set(b).get()) = s.set(b).get()`

A store is a partially applied, existentially quantified lens with a change listener.

### class Store\<S>.static init

```typescript
static init<S>(s0: S): Store<S>
```

Make the root store





### class Store\<S>.get

```typescript
get(): S
```

Get the current value (which must not be mutated)





### class Store\<S>.set

```typescript
set(s: S): Store<S>
```

Set the value

Returns itself.





### class Store\<S>.modify

```typescript
modify(f: (s: S) => S): Store<S>
```

Modify the value in the store (must not use mutation: construct a new value)

Returns itself.





### class Store\<S>.on

```typescript
on(k: (s: S) => void): () => void
```

React on changes. Returns an unsubscribe function.





### class Store\<S>.transaction

```typescript
transaction<A>(m: () => A): A
```

Start a new transaction: listeners are only invoked when the
(top-level) transaction finishes, and not on set (and modify) inside the transaction.





### class Store\<S>.zoom

```typescript
zoom<T>(lens: Lens<S, T>): Store<T>
```

Zoom in on a subpart of the store via a lens





### class Store\<S>.at

```typescript
at<K extends keyof S>(k: K): Store<S[K]>
```

Make a substore at a key

Note: the key must always be present.





### class Store\<S>.pick

```typescript
pick<Ks extends keyof S>(...ks: Ks[]): Store<{ [K in Ks]: S[K]; }>
```

Make a substore by picking many keys

Note: the keys must always be present.





### class Store\<S>.relabel

```typescript
relabel<T>(stores: { [K in keyof T]: Store<T[K]>; }): Store<T>
```

Make a substore by relabelling

Note: must not use the same part of the store several times.





### class Store\<S>.along

```typescript
along<K extends keyof S, Ks extends keyof S, B>(k: K, s: Store<B>, ...keep: Ks[]):
  Store<{ [k in K]: B; } & { [k in Ks]: S[k]; }>
```

Replace the substore at one field and keep the rest of the shape intact

Note: must not use the same part of the store several times.





### class Store\<S>.static arr

```typescript
static arr<A, K extends keyof Array<A>>(store: Store<Array<A>>, k: K): Array<A>[K]
```

Set the value using an array method (purity is ensured because the spine is copied before running the function)





### class Store\<S>.static partial

Partial substore makers

### class Store\<S>.static partial.each

```typescript
each<A>(store: Store<A[]>): Store<A>[]
```

Get partial stores for each position currently in the array

Note: exceptions are thrown when looking outside the array.









### interface Lens\<S, T>

A lens: allows you to operate on a subpart `T` of some data `S`

Lenses must conform to these three lens laws:

* `l.get(l.set(s, t)) = t`

* `l.set(s, l.get(s)) = s`

* `l.set(l.set(s, a), b) = l.set(s, b)`

### interface Lens\<S, T>.get

```typescript
get(s: S): T
```

Get the value via the lens





### interface Lens\<S, T>.set

```typescript
set(s: S, t: T): S
```

Set the value via the lens







### module Lens

Common lens constructors and functions

### Lens.lens

```typescript
function lens<S, T>(get: (s: S) => T, set: (s: S, t: T) => S): Lens<S, T>
```

Make a lens from a getter and setter

Note: lenses are subject to the three lens laws





### Lens.relabel

```typescript
function relabel<S, T>(lenses: { [K in keyof T]: Lens<S, T[K]>; }): Lens<S, T>
```

Lens from a record of lenses

Note: must not use the same part of the store several times.





### Lens.at

```typescript
function at<S, K extends keyof S>(k: K): Lens<S, S[K]>
```

Lens to a key in a record

Note: the key must always be present.





### Lens.iso

```typescript
function iso<S, T>(f: (s: S) => T, g: (t: T) => S): Lens<S, T>
```

Make a lens from an isomorphism.

Note: requires that for all `s` and `t` we have `f(g(t)) = t` and `g(f(s)) = s`





### Lens.pick

```typescript
function pick<S, Ks extends keyof S>(...keys: Ks[]): Lens<S, { [K in Ks]: S[K]; }>
```

Lens to a keys in a record

Note: the keys must always be present.





### Lens.key

```typescript
function key<S, K extends keyof S>(k: K): Lens<S, S[K] | undefined>
```

Lens to a key in a record which may be missing

Note: setting the value to undefined removes the key from the record.





### Lens.def

```typescript
function def<A>(missing: A): Lens<A | undefined, A>
```

Lens which refer to a default value instead of undefined





### Lens.seq

```typescript
function seq<S, T, U>(lens1: Lens<S, T>, lens2: Lens<T, U>): Lens<S, U>
```

Compose two lenses sequentially





### Lens.module partial

Partial lenses

### Lens.partial.index

```typescript
function index<A>(i: number): Lens<A[], A>
```

Partial lens to a particular index in an array

Note: an exception is thrown if you look outside the array.









### module Undo

History zipper functions

Todo: document this without puns and semi-obscure references

### Undo.undo

```typescript
function undo<S>(h: Undo<S>): Undo<S>
```

Undo iff there is a past





### Undo.redo

```typescript
function redo<S>(h: Undo<S>): Undo<S>
```

Redo iff there is a future





### Undo.advance

```typescript
function advance<S>(h: Undo<S>): Undo<S>
```

Advances the history by copying the present





### Undo.init

```typescript
function init<S>(now: S): Undo<S>
```

Make history





### Undo.now

```typescript
function now<S>(): Lens<Undo<S>, S>
```

Lens to the present moment







### interface Undo\<S>

History zipper

### interface Undo\<S>.tip

```typescript
tip: Stack<S>
```







### interface Undo\<S>.next

```typescript
next: null | Stack<S>
```









### interface Stack\<S>

A non-empty stack

### interface Stack\<S>.top

```typescript
top: S
```







### interface Stack\<S>.pop

```typescript
pop: null | Stack<S>
```










