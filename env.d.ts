/// <reference types="vite/client" />

declare const __APP_VERSION__: string

declare module '*.svg?component' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, any>
  export default component
}
