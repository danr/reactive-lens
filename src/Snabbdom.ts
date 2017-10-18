import * as snabbdom from "snabbdom"
import snabbdom_attrs from 'snabbdom/modules/attributes'
import snabbdom_props from 'snabbdom/modules/props'
import snabbdom_events from 'snabbdom/modules/eventlisteners'
import * as eventlisteners from 'snabbdom/modules/eventlisteners'
import * as vnode from "snabbdom/vnode"

// reexports
export const h = snabbdom.h
export type VNode = vnode.VNode
export type VNodeData = vnode.VNodeData

export function checkbox(value: boolean, update: (new_value: boolean) => void): VNode {
  return h('input', {
    attrs: {type: 'checkbox', value, checked: value},
    on: {
      change: (evt: Event) => update((evt.target as any).checked)
    }
  })
}

export const tag =
  (tag_name: string) =>
  (main_class: string = '', data: VNodeData = {}, ...more_classes: string[]) =>
  (...children: (string | VNode | null | undefined)[]) =>
  h(tag_name, {...data, classes: [main_class, ...more_classes, ...(data.classes || [])]}, children  as any)

export const div = tag('div')
export const span = tag('span')

export const table = tag('table')
export const tbody = tag('tbody')
export const tr = tag('tr')
export const td = tag('td')


declare module "snabbdom/vnode" {
  export interface VNodeData {
    classes?: string[]
  }
}

function update_classes(old_vnode: VNode, vnode: VNode) {
  const elm: Element = vnode.elm as Element
  const old_classes = (old_vnode.data as VNodeData).classes || []
  const classes = (vnode.data as VNodeData).classes || []

  if (old_classes === classes) return;

  const now = {} as Record<string, boolean>
  for (let name of classes) {
    now[name] = true
  }

  const old = {} as Record<string, boolean>
  for (let name of old_classes) {
    if (!now[name] && name) {
      elm.classList.remove(name);
    }
    old[name] = true
  }

  for (let name of classes) {
    if (!(name in old) && name) {
      (elm.classList as any).add(name)
    }
  }
}

const snabbdom_classes = {create: update_classes, update: update_classes}

export const patch = snabbdom.init([
  snabbdom_classes,
  snabbdom_attrs,
  snabbdom_events,
  snabbdom_props
])


export const on = (old: VNode, new_on: eventlisteners.On) => ({
  ...old,
  data: {
    ...(old.data || {}),
    on: {
      ...((old.data || {}).on || {}),
      ...new_on
    }
  }
})

export const withClass = (new_class: string, old: VNode) => ({
  ...old,
  data: {
    ...(old.data || {}),
    classes: [
      ...((old.data || {}).classes || []),
      new_class
    ]
  }
})

