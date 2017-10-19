import * as snabbdom from "snabbdom"
import snabbdom_style from 'snabbdom/modules/style';
import snabbdom_eventlisteners from 'snabbdom/modules/eventlisteners';
import snabbdom_class from 'snabbdom/modules/class';
import snabbdom_props from 'snabbdom/modules/props';
import snabbdom_dataset from 'snabbdom/modules/dataset';
import snabbdom_attributes from 'snabbdom/modules/attributes';
import * as vnode from "snabbdom/vnode"

import { Hooks } from 'snabbdom/hooks';
import { AttachData } from 'snabbdom/helpers/attachto';
import { VNodeStyle } from 'snabbdom/modules/style';
import { On } from 'snabbdom/modules/eventlisteners';
import { Classes } from 'snabbdom/modules/class';
import { Props } from 'snabbdom/modules/props';
import { Dataset } from 'snabbdom/modules/dataset';
import { Attrs } from 'snabbdom/modules/attributes';

// reexports
export const h = snabbdom.h
export type VNode = vnode.VNode
export type VNodeData = vnode.VNodeData

export type Build
  = Array<VNode | undefined  | null>
  | VNode
  | string
  | null
  | undefined
  | { type: 'key', data: string | number}
  | { type: 'props', data: Props }
  | { type: 'attrs', data: Attrs }
  | { type: 'classes', data: Classes }
  | { type: 'style', data: VNodeStyle }
  | { type: 'dataset', data: Dataset }
  | { type: 'on', data: On }
  | { type: 'hook', data: Hooks }

export function id(id: string): Build {
  return {type: 'attrs', data: {id}}
}

export function key(key: string | number): Build {
  return {type: 'key', data: key}
}

export function props(props: Props): Build {
  return {type: 'props', data: props}
}

export function attrs(attrs: Attrs): Build {
  return {type: 'attrs', data: attrs}
}

export function classes(classes: Classes): Build {
  return {type: 'classes', data: classes}
}

export function styles(styles: VNodeStyle): Build {
  return {type: 'style', data: styles}
}

export function dataset(dataset: Dataset): Build {
  return {type: 'dataset', data: dataset}
}

export function hook(hook: Hooks): Build {
  return {type: 'hook', data: hook}
}

export function style(k: string, v: string): Build {
  return styles({[k]: v})
}

export function classed(c: string): Build {
  return classes({[c]: true})
}

export function on<N extends keyof HTMLElementEventMap>(name: N): (h: (e: HTMLElementEventMap[N]) => void) => Build {
  return h => ({type: 'on', data: {[name as string]: h}})
}

export function on_(name: string, h: (e: Event) => void): Build {
  return ({type: 'on', data: {[name]: h}})
}

function has_type<R extends {type: string}>(x: any): x is R {
  return x.type !== undefined
}

export function tag(tag_classes_id: string, ...build: Build[]): VNode {
  let children = [] as Array<VNode | undefined | null>
  let text = undefined as string | undefined
  let key = undefined as string | number | undefined
  let props = {} as Props
  let attrs = {} as Attrs
  let classes = {} as Classes
  let style = {} as VNodeStyle
  let dataset = {} as Dataset
  let on = {} as On
  let hook = {} as Hooks
  let tag_name = 'div'
  const matches = tag_classes_id.match(/([.#]?[^.#\s]+)/g)
  ;
  (matches || []).map(x => {
    if (x.length > 0) {
      if (x[0] == '#') {
        build.push(id(x.slice(1)))
      } else if (x[0] == '.') {
        build.push(classed(x.slice(1)))
      } else {
        tag_name = x
      }
    }
  })
  build.map(b => {
    if (b instanceof Array) {
      children = [...children, ...b]
    } else if (typeof b == 'string') {
      text = b
    } else if (typeof b == 'undefined' || b == null) {
      // skip
    } else if (has_type(b)) {
      switch (b.type) {
        case 'key': key = b.data
        break;
        case 'props': props = {...props, ...b.data}
        break;
        case 'attrs': attrs = {...attrs, ...b.data}
        break;
        case 'classes': classes = {...classes, ...b.data}
        break;
        case 'style': style = {...style, ...b.data}
        break;
        case 'dataset': dataset = {...dataset, ...b.data}
        break;
        case 'on': on = {...on, ...b.data}
        break;
        case 'hook': hook = {...hook, ...b.data}
        break;
      }
    } else {
      children = [...children, b]
    }
  })
  const data = {props, attrs, class: classes, style, dataset, on, hook}
  if (text != undefined) {
    return h(tag_name, data, text)
  } else {
    return h(tag_name, data, children)
  }
}

export const patch = snabbdom.init([
  snabbdom_style,
  snabbdom_eventlisteners,
  snabbdom_class,
  snabbdom_props,
  snabbdom_dataset,
  snabbdom_attributes,
])


/*
function RadioInputs<A>(name: string, r: Ref<A>, opts: {opt: A, cb: (vn: VNode) => VNode}[]): VNode[] {
  const v = r.get()
  return opts.map(({opt, cb}, i) =>
      cb(h('input', {
        attrs: {
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
*/
