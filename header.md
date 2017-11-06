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


