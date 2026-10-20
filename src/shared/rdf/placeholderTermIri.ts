export const PLACEHOLDER_TERM_IRI_PREFIX = 'https://w3id.org/nfdi4ing/terms/'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isPlaceholderTermIri(iri: string | undefined): boolean {
  return Boolean(iri?.startsWith(PLACEHOLDER_TERM_IRI_PREFIX)
    && UUID_PATTERN.test(iri.slice(PLACEHOLDER_TERM_IRI_PREFIX.length)))
}
