import { describe, expect, it } from 'vitest'
import { columnsForSubjects, thumbnailUrlForSubject } from '@/features/browse/browseViewHelpers'
import type { BrowseSubject } from '@/services/browse/browseService'

describe('browseViewHelpers', () => {
  it('uses only schema:image anyURI values as thumbnails', () => {
    const subject: BrowseSubject = {
      iri: 'https://example.org/buildings/1',
      label: 'Building One',
      classes: ['https://example.org/Building'],
      properties: [
        {
          label: 'Thumbnail Image',
          predicate: 'http://schema.org/image',
          value: 'https://v5.airtableusercontent.com/example/building-one',
          isResource: false,
          datatype: 'http://www.w3.org/2001/XMLSchema#anyURI',
        },
        {
          label: 'Other Image',
          predicate: 'https://example.org/customImage',
          value: 'https://example.org/custom.jpg',
          isResource: false,
          datatype: 'http://www.w3.org/2001/XMLSchema#anyURI',
        },
      ],
    }

    expect(thumbnailUrlForSubject(subject)).toBe('https://v5.airtableusercontent.com/example/building-one')
  })

  it('excludes schema:image from list columns once the thumbnail is rendered separately', () => {
    const subject: BrowseSubject = {
      iri: 'https://example.org/buildings/1',
      label: 'Building One',
      classes: ['https://example.org/Building'],
      properties: [
        {
          label: 'Thumbnail Image',
          predicate: 'http://schema.org/image',
          value: 'https://v5.airtableusercontent.com/example/building-one',
          isResource: false,
          datatype: 'http://www.w3.org/2001/XMLSchema#anyURI',
        },
        {
          label: 'Name',
          predicate: 'https://d-nb.info/standards/elementset/gnd#preferredName',
          value: 'Building One',
          isResource: false,
        },
      ],
    }

    expect(columnsForSubjects([subject])).toEqual([
      {
        predicate: 'https://d-nb.info/standards/elementset/gnd#preferredName',
        label: 'Name',
      },
    ])
  })
})