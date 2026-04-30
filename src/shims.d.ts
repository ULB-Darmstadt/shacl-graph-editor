/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// shacl-form web component (registered as side-effect by importing the package)
declare module 'vue' {
  interface GlobalComponents {
    'shacl-form': any
  }
}
export {}
