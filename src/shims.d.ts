/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// shacl-form web component (registered as side-effect by importing the package)
declare module 'vue' {
  interface GlobalComponents {
    'shacl-form': DefineComponent<{
      dataView?: boolean
      dataCollapse?: string
      dataIgnoreOwlImports?: boolean
      dataLanguage?: string
      dataShowRootShapeLabel?: string
    }, object, unknown>
  }
}

export {}


