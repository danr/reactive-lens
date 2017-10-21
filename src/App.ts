import * as Plumbing from './Plumbing'
import * as Snabbdom from "./Snabbdom"
import * as S from "./Snabbdom"

import { tag, Build } from "./Snabbdom"
import { VNode } from "snabbdom/vnode"

import { Ref, record, views, at } from "./Dannelib"

export type Visibility = 'all' | 'complete' | 'incomplete'

const visibilites = ['all', 'complete', 'incomplete'] as Visibility[]

interface Todo {
  id: number,
  text: string,
  completed: boolean
}

export type State = {
  next_id: number,
  todos: Todo[],
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

const remove_todo =
  (id: number) =>
  (todos: Todo[]) =>
  todos.filter(t => t.id != id)

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

const view = (r: Ref<State>) => {
  const {todos, visibility} = r.get()
  const todos_ref = r.proj('todos')

  const Header =
    tag('header .header',
      tag('h1', 'todos'),
      CatchSubmit(
        () => r.modify(new_todo),
        InputField(
          r.proj('new_input'),
          S.attrs({
            placeholder: 'What needs to be done?',
            autofocus: true
          }),
          S.classed('new-todo'))))

   const TodoView =
     (todo_ref: Ref<Todo>, {completed, id, text}: Todo) =>
       tag('li .todo',
         S.classes({ completed }),
         tag('div .view',
           Checkbox(
             completed,
             todo_ref.proj('completed').set,
             S.classed('toggle'),
             S.style('height', '40px')),
           tag('label', text),
           tag('button .destroy',
             S.on('click')(_ => todos_ref.modify(remove_todo(id))))),
         InputField(todo_ref.proj('text'), S.classed('edit')))

   const Main =
     todos.length == 0 ? null :
     tag('section .main',
       Checkbox(
         todos.some(todo => !todo.completed),
         (b: boolean) => todos_ref.modify(
           todos => todos.map(todo => ({...todo, completed: !b}))),
         S.classed('toggle-all'),
         S.id('toggle-all')),
       tag('ul .todo-list',
         views(todos_ref)
         .map(ref => ({ref, todo: ref.get()}))
         .filter(({todo}) => visibility != (todo.completed ? 'incomplete' : 'complete'))
         .map(({ref, todo}) => TodoView(ref, todo))))

  const Footer =
    tag('footer .footer',
      tag('span .todo-count', todos.length.toString()),
      tag('ul .filters',
        visibilites.map((opt: Visibility) =>
          tag('li',
            tag('a',
              S.classes({selected: visibility == opt}),
              S.attrs({href: '#/' + opt}),
              opt)))))

  // todo: clear completed

  return tag('section .todoapp #todoapp', Header, Main, Footer)
}

export const attach =
  Plumbing.attach(
    Plumbing.route(
      visibility_from_hash,
      s => s.visibility,
      view))
