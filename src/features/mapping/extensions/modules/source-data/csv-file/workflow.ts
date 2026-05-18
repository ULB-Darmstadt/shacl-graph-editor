import { createUploadedTabularSource } from '@/domain/DataSource'
import type { useDataStore } from '@/stores/dataStore'
import { parseCsvFile } from '@/features/mapping/extensions/modules/source-data/csv-file/parser'

type DataStore = ReturnType<typeof useDataStore>

export async function importCsvFiles(dataStore: DataStore, files: File[]): Promise<void> {
  for (const file of files) {
    const { headers, rows } = await parseCsvFile(file)
    dataStore.upsertSource(createUploadedTabularSource({
      id: file.name,
      name: file.name,
      headers,
      rows,
      filename: file.name,
      mediaType: 'text/csv',
    }))
  }
}
