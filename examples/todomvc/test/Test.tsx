import {View, Model} from '../src/App'
import {Store} from 'reactive-lens'
import * as React from 'react'
import {shallow, configure} from 'enzyme'
import * as Adapter from 'enzyme-adapter-react-16'
import {test} from 'ava'

configure({adapter: new Adapter()})

const show = (x: any) => JSON.stringify(x, undefined, 2)

test('View', t => {
  const store = Store.init(Model.init)

  const dom = () => shallow(View(store))
  store.on(s => t.log(show(s)))
  store.on(s => {
    t.snapshot(s)
    t.snapshot(dom().debug())
  })

  const input = () => dom().find('.new-todo').dive()
  const todos = () => dom().find('.todo')

  t.is(input().prop('value'), '')
  t.is(todos().length, 0)

  input().simulate('Change', {target: {value: 'Buy groceries'}})

  t.is(input().prop('value'), 'Buy groceries')
  t.is(todos().length, 0)

  input().simulate('KeyDown', {key: 'Enter'})

  t.is(input().prop('value'), '')
  t.is(todos().length, 1)
  t.is(todos().find('label').text(), 'Buy groceries')

  todos().find('button').at(0).simulate('click')

  t.is(input().prop('value'), '')
  t.is(todos().length, 0)
})
