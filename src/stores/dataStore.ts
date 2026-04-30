import { defineStore } from 'pinia'
import { ref } from 'vue'
import { CsvDataSource, AirtableDataSource, type DataSource } from '@/domain/DataSource'
import { parseCsvFile } from '@/services/csvParser'

export const useDataStore = defineStore('data', () => {
  const sources = ref<DataSource[]>([])

  async function addCsvFiles(files: File[]): Promise<void> {
    for (const file of files) {
      try {
        const { headers, rows } = await parseCsvFile(file)
        sources.value.push(new CsvDataSource(file.name, file.name, headers, rows))
      } catch (e) {
        console.error('Failed to parse', file.name, e)
        throw e
      }
    }
  }

  function addAirtableTable(
    tableName: string,
    headers: string[],
    rows: unknown[][],
    recordIds: string[],
  ): void {
    sources.value.push(new AirtableDataSource(tableName, tableName, headers, rows, recordIds))
  }

  function remove(id: string): void {
    sources.value = sources.value.filter(s => s.id !== id)
  }

  function findById(id: string): DataSource | undefined {
    return sources.value.find(s => s.id === id)
  }

  function reset(): void {
    sources.value = []
  }

  return { sources, addCsvFiles, addAirtableTable, remove, findById, reset }
})
