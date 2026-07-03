import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { TabularDataSource } from '@/domain/DataSource'
import ReviewView from '@/views/ReviewView.vue'
import { useDataStore } from '@/stores/dataStore'

const toastAddMock = vi.fn()
const buildRuntimeStagingShapesMock = vi.fn()
const generateRdfMock = vi.fn()
const serializeGraphMock = vi.fn()
const buildBrowseModelMock = vi.fn()

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAddMock }),
}))

vi.mock('@/features/browse/components/SubjectDetailDialog.vue', () => ({
  default: {
    template: '<div />',
  },
}))

vi.mock('@/services/rdf/rdfGenerator', () => ({
  generateRdf: (...args: unknown[]) => generateRdfMock(...args),
  serializeGraph: (...args: unknown[]) => serializeGraphMock(...args),
}))

vi.mock('@/services/browse/browseService', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/browse/browseService')>()
  return {
    ...actual,
    buildBrowseModel: (...args: unknown[]) => buildBrowseModelMock(...args),
  }
})

vi.mock('@/services/mapping/stagingShapes', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/mapping/stagingShapes')>()
  return {
    ...actual,
    buildRuntimeStagingShapes: (...args: unknown[]) => buildRuntimeStagingShapesMock(...args),
  }
})

describe('ReviewView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    toastAddMock.mockReset()
    buildRuntimeStagingShapesMock.mockReset()
    generateRdfMock.mockReset()
    serializeGraphMock.mockReset()
    buildBrowseModelMock.mockReset()
    buildRuntimeStagingShapesMock.mockReturnValue({
      profile: null,
      nodeShapes: [],
      turtle: '',
    })
    generateRdfMock.mockReturnValue({
      store: { statements: [] },
      subjectCount: 0,
      tripleCount: 0,
    })
    serializeGraphMock.mockResolvedValue('')
    buildBrowseModelMock.mockReturnValue({
      totalSubjects: 0,
      groups: [],
    })
  })

  function mountView() {
    return mount(ReviewView, {
      global: {
        stubs: {
          Message: { template: '<div class="message"><slot /></div>' },
          Button: { template: '<button><slot /></button>' },
          InputText: { template: '<input />' },
          SelectButton: {
            props: ['options'],
            emits: ['update:modelValue'],
            template: `
              <div class="layout-switcher">
                <button
                  v-for="option in options"
                  :key="option.value"
                  type="button"
                  class="layout-switcher__option"
                  :data-layout="option.value"
                  @click="$emit('update:modelValue', option.value)"
                >
                  <slot name="option" :option="option" />
                </button>
              </div>
            `,
          },
          Tag: { template: '<span><slot /></span>' },
        },
      },
    })
  }

  it('surfaces staging-shape generation errors instead of crashing during mount', async () => {
    const dataStore = useDataStore()
    dataStore.upsertSource(new TabularDataSource({
      id: 'source-1',
      name: 'Source One',
      headers: ['Name'],
      rows: [['Alpha']],
      role: 'source',
      origin: { kind: 'uploaded-file', filename: 'source.csv', mediaType: 'text/csv' },
    }))
    buildRuntimeStagingShapesMock.mockImplementation(() => {
      throw new Error('Synthetic staging-shape failure')
    })

    const wrapper = mountView()
    await Promise.resolve()
    await Promise.resolve()

    expect(wrapper.text()).toContain('Synthetic staging-shape failure')
  })

  it('renders a thumbnail image in the left label column when a subject exposes an image URL', async () => {
    const dataStore = useDataStore()
    dataStore.upsertSource(new TabularDataSource({
      id: 'source-1',
      name: 'Source One',
      headers: ['Name'],
      rows: [['Alpha']],
      role: 'source',
      origin: { kind: 'uploaded-file', filename: 'source.csv', mediaType: 'text/csv' },
    }))
    buildBrowseModelMock.mockReturnValue({
      totalSubjects: 1,
      groups: [{
        classIri: 'https://example.org/Building',
        classLabel: 'Building',
        count: 1,
        subjects: [{
          iri: 'https://example.org/buildings/1',
          label: 'Building One',
          classes: ['https://example.org/Building'],
          properties: [{
            label: 'Thumbnail Image',
            predicate: 'http://schema.org/image',
            value: 'https://v5.airtableusercontent.com/example/building-one.jpg',
            isResource: false,
            datatype: 'http://www.w3.org/2001/XMLSchema#anyURI',
          }],
        }, {
          iri: 'https://example.org/buildings/2',
          label: 'Building Two',
          classes: ['https://example.org/Building'],
          properties: [],
        }],
      }],
    })

    const wrapper = mountView()
    await Promise.resolve()
    await Promise.resolve()

    const thumbnail = wrapper.find('img.record-thumbnail')
    expect(thumbnail.exists()).toBe(true)
    expect(thumbnail.attributes('src')).toBe('https://v5.airtableusercontent.com/example/building-one.jpg')
    expect(wrapper.find('thead .record-thumbnail-slot').exists()).toBe(true)
    expect(wrapper.findAll('tbody .record-thumbnail-slot')).toHaveLength(1)
    expect(wrapper.text()).toContain('Building One')
    expect(wrapper.text()).toContain('Building Two')
  })

  it('renders a card view with thumbnail, label, id and class chips', async () => {
    const dataStore = useDataStore()
    dataStore.upsertSource(new TabularDataSource({
      id: 'source-1',
      name: 'Source One',
      headers: ['Name'],
      rows: [['Alpha']],
      role: 'source',
      origin: { kind: 'uploaded-file', filename: 'source.csv', mediaType: 'text/csv' },
    }))
    buildBrowseModelMock.mockReturnValue({
      totalSubjects: 1,
      groups: [{
        classIri: 'https://example.org/Building',
        classLabel: 'Building',
        count: 1,
        subjects: [{
          iri: 'https://example.org/buildings/1',
          label: 'Building One',
          classes: ['https://example.org/Building'],
          properties: [{
            label: 'Thumbnail Image',
            predicate: 'http://schema.org/image',
            value: 'https://v5.airtableusercontent.com/example/building-one.jpg',
            isResource: false,
            datatype: 'http://www.w3.org/2001/XMLSchema#anyURI',
          }],
        }],
      }],
    })

    const wrapper = mountView()
    await Promise.resolve()
    await Promise.resolve()

    await wrapper.find('[data-layout="card"]').trigger('click')
    await Promise.resolve()

    expect(wrapper.find('.card-grid').exists()).toBe(true)
    expect(wrapper.find('img.subject-card__thumbnail').attributes('src')).toBe('https://v5.airtableusercontent.com/example/building-one.jpg')
    expect(wrapper.find('.subject-card__label').text()).toBe('Building One')
    expect(wrapper.find('.subject-card__meta').text()).toBe('1')
    expect(wrapper.text()).toContain('Building')
  })
})