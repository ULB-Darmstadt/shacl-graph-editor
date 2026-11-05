import { Component, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { EuiProvider } from '@elastic/eui'
import { appendIconComponentCache } from '@elastic/eui/src/components/icon/icon'
import { icon as arrowDown } from '@elastic/eui/src/components/icon/assets/arrow_down'
import { icon as arrowRight } from '@elastic/eui/src/components/icon/assets/arrow_right'
import { icon as check } from '@elastic/eui/src/components/icon/assets/check'
import { icon as cross } from '@elastic/eui/src/components/icon/assets/cross'
import { icon as dot } from '@elastic/eui/src/components/icon/assets/dot'
import { icon as empty } from '@elastic/eui/src/components/icon/assets/empty'
import { icon as arrowLeft } from '@elastic/eui/src/components/icon/assets/arrow_left'
import { icon as arrowUp } from '@elastic/eui/src/components/icon/assets/arrow_up'
import { icon as arrowStart } from '@elastic/eui/src/components/icon/assets/arrowStart'
import { icon as arrowEnd } from '@elastic/eui/src/components/icon/assets/arrowEnd'
import { icon as search } from '@elastic/eui/src/components/icon/assets/search'
import { icon as copy } from '@elastic/eui/src/components/icon/assets/copy'
import { icon as popout } from '@elastic/eui/src/components/icon/assets/popout'
import { icon as link } from '@elastic/eui/src/components/icon/assets/link'
import { icon as iInCircle } from '@elastic/eui/src/components/icon/assets/iInCircle'
import { icon as warning } from '@elastic/eui/src/components/icon/assets/warning'
import { icon as minus } from '@elastic/eui/src/components/icon/assets/minus'
import { icon as returnKey } from '@elastic/eui/src/components/icon/assets/return_key'
import { QueryCache, QueryClient, QueryClientProvider } from 'react-query'
import axios from 'axios'
import { SearchResultsListWidget } from '@ts4nfdi/terminology-service-suite'
import '@ts4nfdi/terminology-service-suite/dist/esm/index.css'
import { terminologyTerm, type TerminologyTerm } from '@/shared/rdf/terminologySelection'

type SearchStatus = 'ready' | 'loading' | 'empty' | 'error'
interface WidgetOptions {
  onSelect: (term: TerminologyTerm | null) => void
  onStatus: (status: SearchStatus) => void
}

class WidgetErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? null : this.props.children }
}

/** Loaded only when the terminology dialog opens. Own the React root and query lifecycle. */
export function mountTerminologyWidget(container: HTMLElement, options: WidgetOptions): () => void {
  // EUI's default icon loader uses Webpack-only dynamic paths. Register this widget's icons for Vite.
  appendIconComponentCache({ arrowDown, arrowRight, arrowLeft, arrowUp, arrowStart, arrowEnd, check, cross, dot, empty, search, copy, popout, link, iInCircle, warning, minus, returnKey })
  const abort = new AbortController()
  const api = axios.create({
    baseURL: import.meta.env.VITE_TERMINOLOGY_API_URL || 'https://api.terminology.tib.eu/api/',
    timeout: 20000,
    signal: abort.signal,
    headers: { Accept: 'application/json' },
  })
  api.interceptors.request.use(config => {
    // Preserve the widget's per-query cancellation and abort all metadata requests on close.
    if (config.signal && config.signal !== abort.signal) {
      config.signal = AbortSignal.any([abort.signal, config.signal as AbortSignal])
    }
    if (config.url === 'search') {
      config.params = { ...config.params, q: config.params?.q?.trim() || '*' }
      if (!config.params.type) config.params.type = 'property'
      options.onStatus('loading')
    }
    return config
  })
  api.interceptors.response.use(response => {
    if (response.config.url === 'search') {
      const docs: unknown = response.data?.response?.docs
      if (!Array.isArray(docs) || !Number.isFinite(response.data.response.numFound)) {
        throw new Error('Terminology search requires an OLS search endpoint with pagination and facets')
      }
      // Newer OLS servers use ontologyId even on their legacy search endpoint.
      const facets = response.data.facet_counts?.facet_fields
      if (facets && !facets.ontology_name && Array.isArray(facets.ontologyId)) {
        facets.ontology_name = facets.ontologyId
      }
      options.onStatus(docs.length ? 'ready' : 'empty')
    }
    return response
  })
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => {
      if (query.queryKey[0] === 'searchResults' && !abort.signal.aborted && !axios.isCancel(error)) options.onStatus('error')
    } }),
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
  const root = createRoot(container)
  root.render(createElement(WidgetErrorBoundary, {
    onError: () => options.onStatus('error'),
    children: createElement(EuiProvider, { colorMode: 'light', globalStyles: false },
      createElement(QueryClientProvider, { client },
        createElement(SearchResultsListWidget, {
          // Upstream OlsBaseApi supports AxiosInstance; its widget prop declaration still says string.
          api: api as unknown as string,
          query: '*',
          useLegacy: true,
          initialItemsPerPage: 10,
          itemsPerPageOptions: [10, 25, 50],
          OnNavigateToSearchResult: result => options.onSelect(terminologyTerm(result)),
        }),
      ),
    ),
  }))
  return () => {
    abort.abort()
    root.unmount()
    client.clear()
  }
}
