import * as App from "./App"

const root = document.getElementById('root') as HTMLElement

let App_attach = App.attach

let get = App_attach(root, App.init)

declare const module: any;
declare const require: any;
declare const Debug: boolean

if (Debug) {
  if (module.hot) {
    module.hot.accept('./App.ts', (_: any) => {
      try {
        App_attach = require('./App.ts').attach
        get = App_attach(root, get())
      } catch (e) {
        console.error(e)
      }
    })
  }
}
