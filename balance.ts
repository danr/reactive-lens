// utility script to balance comments and brackets and then documentation

import * as fs from 'fs'

type Groups = Group[]

interface Comment { kind: '/**', value: Groups }
interface Block { kind: '{', header: string, value: Groups }

type Group = Comment | Block | { kind: 'string', value: string }

const buf = fs.readFileSync('reactive-lens.d.ts')
const s = buf.toString()
const n = s.length
const g = (s: string) => '(?:' + s + ')'
const b = (s: string) => '\b' + s + '\b'
const or = (rs: string[]) => g(rs.map(g).join('|'))
const QE = (s: string) => s.replace(/\W/g, x => '\\' + x)
const not = (s: string) => g('(?!' + s + ')')
const plus = (s: string) => g(s + '+')
const semipend = ["module", "class", "interface"]
const balancing = ["/**", "*/", "{", "}", ";"]
const bs = or(balancing.map(QE))
const r = new RegExp(or([bs, plus(g(not(bs) + '(.|\\s)'))]), 'mg')
const m = s.match(r)
const show = (s: any) => JSON.stringify(s, undefined, 2)
//console.log(r)
if (m == null) {
  console.log('no match!')
} else {
  //console.log(m)
  const gs = parse(m)
  //console.log(JSON.stringify(gs, undefined, 2))
  console.log(documentation(gs, 1))
}

function header(d: number): string {
  if (d == 0) {
    return ''
  } else {
    return '#' + header(d-1)
  }
}

function documentation(gs0: Groups, d: number): string {
  const gs = gs0.slice()
  const out = [] as string[]
  const nice = (s: string) => s.replace(/(export|declare)/g, '').replace(/\s+/g, ' ').trim()
  const text = (s: string) => s.replace(/^[ ]*/mg, '').trim()
  const header = (s: string) => '## `' + nice(s) + '`'
  while (gs.length > 0) {
    const g0 = gs[0]
    const g1 = gs[1]
    const g2 = gs[2]
    if (g0 && g1) {
      if (g2 && g0.kind == '/**' && g1.kind == 'string' && g2.kind == '{') {
        out.push(header(g1.value))
        out.push(...g0.value.map(g => text(flattenGroup(g))))
        out.push(text(documentation(g2.value, d+1)))
        gs.shift()
        gs.shift()
        gs.shift()
        continue;
      }
      if (g0.kind == 'string' && g1.kind == '{') {
        out.push(header(g0.value))
        out.push(text(documentation(g1.value, d+1)))
        gs.shift()
        gs.shift()
        continue;
      }
      if (g0.kind == '/**' && g1.kind == 'string') {
        out.push('#' + header(g1.value))
        out.push(...g0.value.map(g => text(flattenGroup(g))))
        //out.push(documentation(g1.value, d+1))
        gs.shift()
        gs.shift()
        continue;
      }
    }
    if (g0.kind == 'string' && g0.value.match(/\s*;?\s*/)) {
      // ok
    } else {
      out.push(show([g0, g1]))
    }
    gs.shift()
  }
  return out.join('\n\n')
}

function check(s: string[], t: string) {
  const top = s.shift()
  if (top != t) {
    console.log('Expected ', t.toString(), ' but got ', top)
    console.log('Remaining: ', s.join(',').toString().slice(0, 20))
  }
}

function slurp(gs: Group[]): string {
  let out = ''
  while (gs.length > 0) {
    const g = gs[0] as Group
    //console.log('slurp', g.kind, g.value, out, gs.length)
    if (g.kind == 'string' && g.value == ';') {
      return out
    } else {
      out += flattenGroup(g)
      gs.shift()
    }
  }
  return out
}

function flatten(gs: Group[]): Group[] {
  const out = [] as Group[]
  while (gs.length > 0) {
    const g0 = gs[0]
    const g1 = gs[1]
    const g2 = gs[2]
    if (g0 && g1 && g2) {
      if (g0.kind == 'string' && semipend.every(s => -1 == g0.value.search(s))) {
        if (g1.kind == '{' && g2.kind == 'string') {
          gs.shift()
          gs.shift()
          gs.shift()
          gs.unshift({kind: 'string', value: g0.value + flattenGroup(g1) + g2.value})
          continue;
        }
      }
    }
    out.push(gs.shift() as Group)
  }
  return out

  /*

  const out = [] as Group[]
  let i = 0
  while (gs.length > 0) {
    const g = gs[0] as Group
    if (gs.length > 1) {
      const gn = gs[1] as Group
      if (gn.kind == '{' && g.kind == 'string') {
        if (g.kind == 'string' && ) {
          while (gs.length > 1 && (gs[0].kind != 'string' || gs[0].value == ';')) {
            console.log('flattening', show(gs))
            console.log('flattening', show(g.value), show(gn.value), show(gs[2]))
            gs.shift()
            gs.shift()
            gs.unshift({kind: 'string', value: g.value + flattenGroup(gn)})
            console.log('after', show(gs[0]), show(gs[1]))
          }
          continue;
        }
      }
    }
    out.push(gs.shift() as Group)
  }
  return out
  */
}

function flattenGroup(g: Group): string {
  //console.log('flatten', g)
  switch (g.kind) {
    case '/**':
      return '/**' + g.value.map(flattenGroup).join('') + '*/'

    case '{':
      return '{' + g.value.map(flattenGroup).join('') + '}'

    case 'string':
      return g.value
  }
}

function parse(s: string[]): Groups {
  const groups = [] as Group[]
  while (s.length > 0 && s[0] != '*/' && s[0] != '}') {
    //console.log('calling', s)
    groups.push(parseGroup(s.shift() as string, s))
  }
  //console.log('groups:', groups)
  const fgroups = flatten(groups)
  //console.log('fgroups:', fgroups)
  return fgroups
}

function parseGroup(kind: string, s: string[]): Group {
  if (kind == '/**') {
    const value = parse(s)
    check(s, '*/')
    return {kind, value}
  } else if (kind == '{') {
    const value = parse(s)
    check(s, '}')
    return {kind: '{', header: kind, value}
  } else {
    return {kind: 'string', value: kind}
  }
}
