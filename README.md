# projective

`projective`: a tiny library for pure, reactive and composable state.

## The gist

```javascript
import { Ref } from 'projective'

const increment = x => x + 1
const decrement = x => x - 1

const ref = Ref.root({left: 0, right: 0})

ref.on(x => console.log(x))

ref.proj('left').modify(increment)
ref.proj('right').modify(increment)
ref.proj('left').modify(decrement)
```

That's it!

