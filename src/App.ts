import * as Plumbing from './Plumbing'
import * as Snabbdom from "./Snabbdom"
import * as typestyle from "typestyle"

import { style } from "typestyle"
import { h, tag, div, span, checkbox } from "./Snabbdom"
import { VNode } from "snabbdom/vnode"

import { Ref, record, views, at } from "./Dannelib"

export type Visibility = 'all' | 'complete' | 'incomplete'

const visibilites = ['all', 'complete', 'incomplete'] as Visibility[]

export type State = {
  next_id: number,
  todos: {
    id: number,
    text: string,
    completed: boolean
  }[],
  new_input: string,
  visibility: Visibility
}

function visibility_from_hash(hash: string, s: State): State {
  const bare = hash.slice(1)
  if (visibilites.some(x => x == bare)) {
    return {
      ...s,
      visibility: bare as Visibility
    }
  } else {
    return s
  }
}

export const init: State = Plumbing.stored_or({
  next_id: 0,
  todos: [],
  new_input: '',
  visibility: 'all',
})

function new_todo(s: State): State {
  if (s.new_input != '') {
    return {
      ...s,
      next_id: s.next_id + 1,
      new_input: '',
      todos:
        [...s.todos, {
          id: s.next_id,
          text: s.new_input,
          completed: false
        }],
    }
  } else {
    return s
  }
}

function remove_todo(s: State, id: number): State {
  return {
    ...s,
    todos: s.todos.filter(t => t.id != id)
  }
}

const CatchSubmit = (cb: () => void, ...vs: VNode[]) =>
  h('form', {
    on: {
      submit: (e: Event) => {
        cb()
        e.preventDefault()
      }
    }
  }, ...vs)

const InputField = (r: Ref<string>) =>
  h('input', {
    props: {
      type: 'text',
      value: r.get()
    },
    on: {
      input: (e: Event) => r.set((e.target as HTMLInputElement).value),
    }
  })

function RadioInputs<A>(name: string, r: Ref<A>, opts: {opt: A, cb: (vn: VNode) => VNode}[]): VNode[] {
  const v = r.get()
  return opts.map(({opt, cb}, i) =>
      cb(h('input', {
        props: {
          type: 'radio',
          checked: v == opt,
          value: i
        },
        on: {
          change(e: Event) {
            if ((e.target as HTMLInputElement).checked) {
              r.set(opt)
            }
          }
        }
      })))
}

const Complete = style({
  color: '#090',
  textDecoration: 'line-through',
})

const Incomplete = style({
  color: '#d00',
})

const Pointer = style({
  cursor: 'pointer',
})

const MainStyle = style({
  fontFamily: "'Lato', sans-serif",
  fontSize: '15px'
})

const view = (r: Ref<State>) =>
  div(MainStyle)(
    CatchSubmit(
      () => r.modify(new_todo),
      InputField(r.proj('new_input'))
    ),
    div()(
      ...RadioInputs('visibility', r.proj('visibility'),
        visibilites.map(opt => ({
          opt: opt,
          cb: (vn: VNode) => span()(vn, span()(opt))
        }))
      )
    ),
    ...views(r.proj('todos'))
      .filter(todo => r.get().visibility != (todo.get().completed ? 'incomplete' : 'complete'))
      .map(todo =>
        div()(
          span(Pointer, {
            on: {
              click: (_: Event) => r.modify(s => remove_todo(s, todo.proj('id').get()))
            }
          })('x '),
          span(todo.proj('completed').get() ? Complete : Incomplete, {
            on: {
              click: (_: Event) => todo.proj('completed').modify(b => !b)
            },
          }, Pointer)(todo.proj('text').get())
        )
      )
  )

export const bind = Plumbing.bind(Plumbing.route(visibility_from_hash, s => s.visibility, view))
