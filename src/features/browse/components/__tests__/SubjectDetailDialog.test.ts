import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SubjectDetailDialog from '@/features/browse/components/SubjectDetailDialog.vue'

vi.mock('cytoscape', () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    layout: vi.fn(() => ({ run: vi.fn() })),
    fit: vi.fn(),
    destroy: vi.fn(),
  })),
}))

vi.mock('@ulb-darmstadt/shacl-form', () => ({}))

vi.mock('@ulb-darmstadt/shacl-form/plugins/leaflet.js', () => ({
  LeafletPlugin: class {},
}))

vi.mock('@/features/shacl/useShaclFormViewer', () => ({
  useShaclFormViewer: vi.fn(),
}))

describe('SubjectDetailDialog', () => {
  it('renders a subject thumbnail above the SHACL form when an image URL is present', () => {
    const wrapper = mount(SubjectDetailDialog, {
      props: {
        modelValue: true,
        subjectIri: 'https://example.org/buildings/1',
        model: {
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
        },
        shapes: [],
        shapesTurtle: '',
        valuesTurtle: '',
      },
      global: {
        stubs: {
          Dialog: {
            props: ['visible', 'header'],
            template: '<div class="dialog"><slot /></div>',
          },
          Button: true,
          Tag: true,
          'shacl-form': true,
        },
      },
    })

    const thumbnail = wrapper.find('img.subject-preview-image')
    expect(thumbnail.exists()).toBe(true)
    expect(thumbnail.attributes('src')).toBe('https://v5.airtableusercontent.com/example/building-one.jpg')
  })
})