declare module '@rdfjs/data-model' {
  import type { DataFactory } from '@rdfjs/types'
  const factory: DataFactory
  export default factory
}

declare module '@rdfjs/dataset' {
  import type { DatasetCore, Quad } from '@rdfjs/types'
  const datasetFactory: {
    dataset(): DatasetCore<Quad>
  }
  export default datasetFactory
}

declare module 'shacl-engine' {
  interface ShaclEngineReport {
    conforms: boolean
    results: unknown[]
  }

  export class Validator {
    constructor(dataset: unknown, options: Record<string, unknown>)
    validate(data: { dataset: unknown; terms?: Iterable<unknown> }, shapes?: { terms?: Iterable<unknown> }): Promise<ShaclEngineReport>
  }
}

declare module 'shacl-engine/sparql.js' {
  export const validations: Map<unknown, unknown>
  export const targetResolvers: Map<unknown, unknown>
}
