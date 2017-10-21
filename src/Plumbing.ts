import * as Snabbdom from "./Snabbdom"

import { VNode } from "snabbdom/vnode"

import { Ref } from "./Dannelib"

export function attach<S>(view: (ref: Ref<S>) => VNode):
    (root_element: HTMLElement, s0: S) => () => S {
  return (root_element: HTMLElement, s0: S) => {
    const r = Ref.root(s0)
    ; (window as any).r = r
    const patch = setup(root_element)
    function redraw() {
      patch(view(r))
    }
    r.on(s => {
      console.log(JSON.stringify(s, undefined, 2))
      window.localStorage.setItem('state', JSON.stringify(s))
      redraw()
    })
    redraw()
    return r.get
  }
}

function setup(root_element: HTMLElement): (vnode: VNode) => void {
  while (root_element.lastChild) {
    root_element.removeChild(root_element.lastChild)
  }

  const container = document.createElement('div')
  root_element.appendChild(container)
  let vnode = Snabbdom.patch(container, Snabbdom.h('div'))

  return new_vnode => {
    vnode = Snabbdom.patch(vnode, new_vnode)
  }
}

export function stored_or<S>(s: S) {
  const stored = window.localStorage.getItem('state')
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch (e) {
      return s
    }
  } else {
    return s
  }
}

export function route<S, R>(
    populate_hash: (h: string, s: S) => S,
    get_hash: (s: S) => string,
    view: (r: Ref<S>) => R): (r: Ref<S>) => R {
  return r => {
    window.onhashchange = () => {
      r.modify(s => populate_hash(window.location.hash, s))
    }
    window.location.hash = get_hash(r.get())
    return view(r)
  }
}

