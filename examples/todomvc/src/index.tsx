import * as App from './App'
import './index.css'
import {render} from 'react-dom'
import {attach} from 'reactive-lens'

const root = document.getElementById('root') as HTMLElement
const reattach = attach(vn => render(vn, root), App.Model.init, App.App)

declare const module: any
declare const require: any

if (module.hot) {
  module.hot.accept(() => {
    try {
      reattach(require('./App.tsx').App)
    } catch (e) {
      console.error(e)
    }
  })
}
