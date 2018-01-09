import * as React from 'react'
import {Store, Lens} from 'reactive-lens'
import * as Model from './Model'
import {State, Todo, Visibility} from './Model'

export {Model}

type VNode = React.ReactElement<{}>

export const True = (classes: Record<string, boolean>) =>
  Object.keys(classes)
    .filter(k => classes[k])
    .join(' ')

export const App = (store: Store<State>) => {
  const global = window as any
  global.store = store
  global.reset = () => store.set(Model.init)
  store.storage_connect('todomvc')
  store.at('visibility').location_connect(Model.to_hash, Model.from_hash)
  store.on(x => console.log(JSON.stringify(x, undefined, 2)))
  return () => View(store)
}
export const View = (store: Store<State>): VNode => {
  const {todos, visibility} = store.get()
  const todos_store = store.at('todos')

  const Header = (
    <header className="header">
      <h1>todos</h1>
      <Input
        store={store.at('new_input')}
        onKeyDown={e => e.key == 'Enter' && store.modify(Model.new_todo)}
        placeholder="What needs to be done?"
        autoFocus={true}
        className="new-todo"
      />
    </header>
  )

  const TodoView = (
    todo_store: Store<Todo>,
    {completed, text, editing, id}: Todo,
    rm: () => void
  ) => (
    <li key={id} className={'todo ' + True({completed, editing})}>
      <div className={True({view: !editing})}>
        <Checkbox store={todo_store.at('completed')} className="toggle" style={{height: '40px'}} />
        {editing ? (
          <Input
            store={todo_store.at('text')}
            onKeyDown={e => e.key == 'Enter' && todo_store.at('editing').set(false)}
            onBlur={() => todo_store.at('editing').set(false)}
            className="edit"
          />
        ) : (
          <label
            style={{cursor: 'pointer'}}
            onDoubleClick={() => todo_store.at('editing').set(true)}>
            {text}
          </label>
        )}
        <button className="destroy" onClick={rm} />
      </div>
    </li>
  )

  const Main = todos.length > 0 && (
    <section className="main">
      <input
        type="checkbox"
        checked={Model.all_completed(todos)}
        onChange={e => todos_store.modify(Model.set_all(!e.target.checked))}
        className="toggle-all"
        id="toggle-all"
      />
      <ul className="todo-list">
        {Store.each(todos_store).map((store, i) => {
          const todo = store.get()
          const rm = () => todos_store.modify(Model.remove_todo(i))
          if (Model.todo_visible(todo, visibility)) {
            return TodoView(store, todo, rm)
          }
        })}
      </ul>
    </section>
  )

  const Footer = (
    <footer className="footer">
      <span className="todo-count">{todos.length.toString()}</span>
      <ul className="filters">
        {Model.visibilites.map((opt: Visibility) => (
          <li key={opt}>
            <a className={True({selected: visibility == opt})} href={'#/' + opt}>
              {opt}
            </a>
          </li>
        ))}
      </ul>
    </footer>
  )

  // todo: clear completed

  return (
    <section id="todoapp" className="todoapp">
      {Header}
      {Main}
      {Footer}
    </section>
  )
}

export type InputAttrs = React.InputHTMLAttributes<HTMLInputElement>

export const Input = ({store, ...props}: {store: Store<string>} & InputAttrs) => (
  <input {...props} value={store.get()} onChange={e => store.set(e.target.value)} />
)

export const Checkbox = ({store, ...props}: {store: Store<boolean>} & InputAttrs) => (
  <input
    {...props}
    type="checkbox"
    checked={store.get()}
    onChange={e => store.set(e.target.checked)}
  />
)
