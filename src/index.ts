import * as csstips from "csstips"
import * as App from "./App"
csstips.normalize()
csstips.setupPage('#root')

const root = document.getElementById('root') as HTMLElement

let App_bind = App.bind

let get = App_bind(root, App.init)

declare const module: any;
declare const require: any;
declare const Debug: boolean

if (Debug) {
  if (module.hot) {
    module.hot.accept('./App.ts', (_: any) => {
      try {
        App_bind = require('./App.ts').bind
        get = App_bind(root, get())
      } catch (e) {
        console.error(e)
      }
    })
  }
}
