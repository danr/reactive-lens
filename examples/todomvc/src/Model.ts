export type Visibility = 'all' | 'complete' | 'incomplete'

export const visibilites = ['all', 'complete', 'incomplete'] as Visibility[]

export interface Todo {
  readonly id: number
  readonly text: string
  readonly completed: boolean
  readonly editing: boolean
}

export interface State {
  readonly next_id: number
  readonly todos: Todo[]
  readonly new_input: string
  readonly visibility: Visibility
}

export const init: State = {
  next_id: 0,
  todos: [],
  new_input: '',
  visibility: 'all',
}

export function from_hash(hash: string): Visibility | undefined {
  const bare = hash.slice(2)
  if (visibilites.some(x => x == bare)) {
    return bare as Visibility
  } else {
    return undefined
  }
}

export function to_hash(vis: Visibility) {
  return ('#/' + vis) as string
}

export function new_todo(s: State): State {
  if (s.new_input != '') {
    return {
      ...s,
      next_id: s.next_id + 1,
      new_input: '',
      todos: s.todos.concat({
        id: s.next_id,
        text: s.new_input,
        completed: false,
        editing: false,
      }),
    }
  } else {
    return s
  }
}

export function todo_visible(todo: Todo, vis: Visibility) {
  return vis != (todo.completed ? 'incomplete' : 'complete')
}

export function remove_todo(i: number) {
  return (todos: Todo[]) => splice(todos, i, 1)
}

export function all_completed(todos: Todo[]) {
  return todos.some(todo => !todo.completed)
}

export function set_all(completed: boolean) {
  return (todos: Todo[]) => todos.map(todo => ({...todo, completed}))
}

function splice<A>(xs: A[], start: number, count: number, ...insert: A[]): A[] {
  const ys = xs.slice()
  ys.splice(start, count, ...insert)
  return ys
}
