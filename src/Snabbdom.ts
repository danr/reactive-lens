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

const enum BuildType {
  Key,
  Props,
  Attrs,
  Classes,
  Style,
  Dataset,
  On,
  Hook,
}

export type Build
  = Array<VNode | undefined  | null>
  | VNode
  | string
  | null
  | undefined
  | { type: BuildType.Key, data: string | number}
  | { type: BuildType.Props, data: Props }
  | { type: BuildType.Attrs, data: Attrs }
  | { type: BuildType.Classes, data: Classes }
  | { type: BuildType.Style, data: VNodeStyle }
  | { type: BuildType.Dataset, data: Dataset }
  | { type: BuildType.On, data: On }
  | { type: BuildType.Hook, data: Hooks }

export function id(id: string): Build {
  return {type: BuildType.Attrs, data: {id}}
}

export function key(key: string | number): Build {
  return {type: BuildType.Key, data: key}
}

export function props(props: Props): Build {
  return {type: BuildType.Props, data: props}
}

export function attrs(attrs: Attrs): Build {
  return {type: BuildType.Attrs, data: attrs}
}

export function classes(classes: Classes): Build {
  return {type: BuildType.Classes, data: classes}
}

export function styles(styles: VNodeStyle): Build {
  return {type: BuildType.Style, data: styles}
}

export function dataset(dataset: Dataset): Build {
  return {type: BuildType.Dataset, data: dataset}
}

export function hook(hook: Hooks): Build {
  return {type: BuildType.Hook, data: hook}
}

export function style(k: string, v: string): Build {
  return styles({[k]: v})
}

export function classed(c: string): Build {
  return classes({[c]: true})
}

export function on<N extends keyof HTMLElementEventMap>(name: N): (h: (e: HTMLElementEventMap[N]) => void) => Build {
  return h => ({type: BuildType.On, data: {[name as string]: h}})
}

export function on_(name: string, h: (e: Event) => void): Build {
  return ({type: BuildType.On, data: {[name]: h}})
}

function has_type<R extends {type: BuildType}>(x: any): x is R {
  return x.type !== undefined
}

function imprint<T>(base: Record<string, T>, more: Record<string, T>) {
  for (const k in more) {
    base[k] = more[k]
  }
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
      children.push(...b)
    } else if (typeof b == 'string') {
      text = b
    } else if (typeof b == 'undefined' || b == null) {
      // skip
    } else if (has_type(b)) {
      switch (b.type) {
        case BuildType.Key: key = b.data
        break;
        case BuildType.Props: imprint(props, b.data)
        break;
        case BuildType.Attrs: imprint(attrs, b.data)
        break;
        case BuildType.Classes: imprint(classes, b.data)
        break;
        case BuildType.Style: imprint(style, b.data)
        break;
        case BuildType.Dataset: imprint(dataset, b.data)
        break;
        case BuildType.On: imprint(on, b.data)
        break;
        case BuildType.Hook: imprint(hook as Record<string, any>, b.data)
        break;
      }
    } else {
      children.push(b)
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
