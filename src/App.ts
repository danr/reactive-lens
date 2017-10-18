import * as Plumbing from './Plumbing'
import * as Snabbdom from "./Snabbdom"
import * as S from "./Snabbdom"
import * as typestyle from "typestyle"

import { style } from "typestyle"
import { tag, Build } from "./Snabbdom"
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
  const bare = hash.slice(2)
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

const CatchSubmit = (cb: () => void, ...bs: Build[]) =>
  tag('form',
    S.on('submit')((e: Event) => {
        cb()
        e.preventDefault()
      }),
    ...bs)

const InputField = (r: Ref<string>, ...bs: Build[]) =>
  tag('input',
    S.attrs({
      type: 'text',
      value: r.get()
    }),
    S.on('input')((e: Event) => r.set((e.target as HTMLInputElement).value)),
    ...bs)

// actually not a checkbox
export const Checkbox =
  (value: boolean, update: (new_value: boolean) => void, ...bs: Build[]) =>
  tag('span',
    S.classes({checked: value}),
    S.on('click')((_: MouseEvent) => update(!value)),
    S.on('input')((_: Event) => update(!value)),
    S.styles({cursor: 'pointer'}),
    ...bs)

const view = (r: Ref<State>) =>
  tag('section', S.classed('todoapp'), S.id('todoapp'),
    tag('header', S.classed('header'),
      tag('h1', 'todos'),
      CatchSubmit(
        () => r.modify(new_todo),
        InputField(
          r.proj('new_input'),
          S.attrs({
            placeholder: 'What needs to be done?',
            autofocus: true
          }),
          S.classed('new-todo')
        )
      )
    ),
    r.get()['todos'].length == 0 ? null :
    tag('section', S.classed('main'),
      Checkbox(
        r.proj('todos').get().some(todo => !todo.completed),
        (_: boolean) => r.proj('todos').modify(
          todos => todos.map(todo => ({...todo, completed: true}))
        ),
        S.classed('toggle-all'),
        S.id('toggle-all')),
      tag('ul', S.classed('todo-list'),
        ...views(r.proj('todos'))
        .filter(todo => r.get().visibility != (todo.get().completed ? 'incomplete' : 'complete'))
        .map(todo =>
          tag('li',
            S.classes({
              completed: todo.proj('completed').get(),
              todo: true
            }),
            tag('div', S.classed('view'),
              Checkbox(
                todo.proj('completed').get(),
                todo.proj('completed').set,
                S.classed('toggle'),
                S.style('height', '40px')),
              tag('label', todo.proj('text').get()),
              tag('button',
                S.classed('destroy'),
                S.on('click')((_: Event) =>
                  r.modify(s => remove_todo(s, todo.proj('id').get()))))
            ),
            InputField(todo.proj('text'), S.classed('edit'))
          )
        )
      )
    ),
    tag('footer', S.classed('footer'),
      tag('span', S.classed('todo-count'), r.proj('todos').get().length.toString()),
      tag('ul', S.classed('filters'),
        ...visibilites.map((opt: Visibility) =>
          tag('li',
            tag('a',
              S.classes({selected: r.proj('visibility').get() == opt}),
              S.attrs({href: '#/' + opt}),
              opt)
          )
        )
      )
      // todo: clear completed
    )
  )

export const bind =
  Plumbing.bind(
    Plumbing.route(
      visibility_from_hash,
      s => s.visibility,
      view))
