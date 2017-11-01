// utility script to balance comments and brackets and then documentation

import * as fs from 'fs'
const show = (s: any) => JSON.stringify(s, undefined, 2)

type Groups = Group[]

interface Block { kind: 'block', open: string, value: Groups, close: string }
interface Literal { kind: 'string', value: string }

type Group = Block | Literal

function traverse(f: (gs: Group[]) => Group[], gs: Group[]): Group[] {
  let out = [] as Group[]
  for (let i = gs.length - 1; i >= 0; i--) {
    let g = gs[i]
    if (g.kind == 'block') {
      g = {...g, value: traverse(f, g.value)}
    }
    out.unshift(g)
    out = f(out)
  }
  return out
}

function flatten(g: Group): string {
  switch (g.kind) {
    case 'block':  return g.open + inner(g) + g.close
    case 'string': return g.value
  }
}

function inner(g: Group): string {
  switch (g.kind) {
    case 'block':  return g.value.map(flatten).join('')
    case 'string': return g.value
  }
}

function balance(s: string, pairs: [string, string][], separators: string[] = []): Group[] {
  const g = (s: string) => '(?:' + s + ')'
  const or = (rs: string[]) => g(rs.map(g).join('|'))
  const QE = (s: string) => s.replace(/\W/g, x => '\\' + x)
  const not = (s: string) => g('(?!' + s + ')')
  const plus = (s: string) => g(s + '+')
  const balancing = (separators).concat(...pairs)
  const bs = or(balancing.map(QE))
  const r = new RegExp(or([bs, plus(g(not(bs) + '(.|\\s)'))]), 'mg')
  const m = s.match(r)

  let d: string[]

  if (m) {
    d = m
    return parse('')
  } else {
    throw 'No parse'
  }

  function parse(until: string): Groups {
    const groups = [] as Group[]
    while (d.length > 0 && d[0] != until) {
      groups.push(parseGroup(d.shift() as string))
    }
    return groups
  }

  function parseGroup(open: string): Group {
    for (const p of pairs) {
      if (p[0] == open) {
        const value = parse(p[1])
        const top = d.shift()
        if (top != p[1]) {
          console.log(p)
          throw 'Expected ' + p[1] + ' but got ' + top
        }
        return {kind: 'block', open: p[0], value, close: p[1]}
      }
    }
    // const value = parse()
    return {kind: 'string', value: open}
  }
}

const sections = ["module", "class", "interface", "readonly"]

function headers(gs: Group[]): Group[] {
  const g0 = gs[0]
  const g1 = gs[1]
  const g2 = gs[2]
  if (
    g0 && g0.kind == 'string' &&
    g1 && g1.kind == 'block' && g1.open == '{' &&
    g2 && g2.kind == 'string' &&
    sections.every(s => -1 == g0.value.search(s))
  ) {
    const g: Group = {kind: 'string', value: g0.value + flatten(g1) + g2.value}
    return headers([g as Group].concat(gs.slice(3)))
  }
  return gs
}

interface Entry {
  header: string,
  docstring: string,
  children: Entry[]
}

function mapEntries(f: (e: Entry) => Entry, es: Entry[]): Entry[] {
  return es.map(e => f({...e, children: mapEntries(f, e.children)}))
}

function filterEntries(f: (e: Entry) => boolean, es: Entry[]): Entry[] {
  return es.map(e => ({...e, children: filterEntries(f, e.children)})).filter(f)
}

function documentation(gs0: Groups): Entry[] {
  const gs = gs0.slice()
  const out = [] as Entry[]
  while (gs.length > 0) {
    const g0 = gs[0]
    const g1 = gs[1]
    const g2 = gs[2]
    if (g0 && g1) {
      if (
        g2 &&
        g0.kind == 'block' && g0.open == '/**' &&
        g1.kind == 'string' &&
        g2.kind == 'block' && g2.open == '{'
      ) {
        out.push({
          header: g1.value,
          docstring: inner(g0),
          children: documentation(g2.value)
        })
        gs.shift()
        gs.shift()
        gs.shift()
        continue;
      }
      if (
        g0.kind == 'string' &&
        g1.kind == 'block' && g1.open == '{'
      ) {
        out.push({
          header: g0.value,
          docstring: '',
          children: documentation(g1.value)
        })
        gs.shift()
        gs.shift()
        continue;
      }
      if (
        g0.kind == 'block' && g0.open == '/**' &&
        g1.kind == 'string'
      ) {
        out.push({
          header: g1.value,
          docstring: inner(g0),
          children: []
        })
        gs.shift()
        gs.shift()
        continue;
      }
    }
    if (g0.kind == 'string' && g0.value.match(/^\s*;?\s*$/)) {
      // ok
    } else if (g0.kind == 'string') {
      out.push({header: g0.value, docstring: '', children: []})
    } else {
      console.log('whatis: ', show([g0, g1]))
    }
    gs.shift()
  }
  return out
}

function pretty(entry: Entry): Entry {
  const {header, docstring} = entry
  const nice = (s: string) => s.replace(/(export|declare|readonly|:\s*$)/g, '').replace(/\s+/g, ' ').trim()
  const text = (s: string) => s.replace(/^[ ]*/mg, '').trim()
  const wrap = (s: string) => {
    const breakes = [':', '=>']
    const components = balance(s, [['(', ')'], ['{', '}'], ['[', ']']], breakes).map(flatten)
    function group(): string[] {
      const c = components.shift()
      if (c === undefined) {
        return []
      } else if (breakes.some(b => null != c.match('^' + b + '$'))) {
        return [c].concat(group())
      } else {
        const g = group().slice()
        const h = g.shift()
        if (h === undefined) {
          return [c]
        } else {
          return [c + h].concat(g)
        }
      }
    }
    const m = group()
    let active = [] as string[]
    const out = [active]
    while (m.length > 0) {
      const s = m.shift() as string
      if (active.join('').length + s.length > 90) {
        active = []
        out.push(active)
      }
      active.push(s)
    }
    return out.map(s => s.join('').trim()).join('\n  ')
  }
  return {
    ...entry,
    header: wrap(text(nice(header))),
    docstring: text(docstring)
  }
}

function explicitHierarchy(entry: Entry): Entry {
  const {header, docstring, children} = entry
  if (children.length == 0) {
    const m = header.match(/^(?:function |)(static \w+|\w+)/)
    return {
      ...entry,
      header: m == null ? header : m[1],
      docstring: '```typescript\n' + header + '\n```\n\n' + docstring
    }
  } else {
    return {
      ...entry,
      children: mapEntries(e => ({...e, header: header.replace(/module /, '').trim() + '.' + e.header}), children)
    }
  }
}

function hashes(d: number): string {
  if (d == 0) {
    return ''
  } else {
    return '#' + hashes(d-1)
  }
}

function linearise(es: Entry[], depth: number): string {
  return es.map(e => linearise1(e, depth)).join('\n\n') + '\n\n'
}

function linearise1(entry: Entry, depth: number): string {
  const {header, docstring, children} = entry
  return hashes(depth) + ' ' + header.replace('<', '\\<') + '\n\n' + docstring + '\n\n' + linearise(children, depth)
}

const buf = fs.readFileSync('reactive-lens.d.ts')
const s = buf.toString()
const m = balance(s, [["/**", "*/"], ["{", "}"]], [';'])

console.log(
  (e => linearise(e, 3))(
  mapEntries(explicitHierarchy,
  mapEntries(pretty,
  filterEntries(e => e.header.search(/private/) == -1,
  documentation(
  traverse(headers, m)))))))

