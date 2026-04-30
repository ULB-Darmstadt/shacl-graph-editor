/**
 * DataSource — common interface for tabular data (CSV, Airtable, …).
 */
export interface DataSource {
  /** Stable key used for mapping references; usually file or table name. */
  readonly id: string
  /** Human-readable display name. */
  readonly name: string
  /** Origin of the data, used for UI badges. */
  readonly kind: 'csv' | 'airtable'
  /** Column headers in source order. */
  readonly headers: string[]
  /** Raw rows, indexed by header position. */
  readonly rows: unknown[][]
  /**
   * Optional per-row primary identifiers used as the URI suffix when
   * generating RDF subjects (e.g. Airtable record IDs). When absent the
   * first column value is used as a fallback.
   */
  readonly recordIds?: string[]
}

export class CsvDataSource implements DataSource {
  readonly kind = 'csv' as const
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly headers: string[],
    public readonly rows: unknown[][],
  ) {}
}

export class AirtableDataSource implements DataSource {
  readonly kind = 'airtable' as const
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly headers: string[],
    public readonly rows: unknown[][],
    public readonly recordIds: string[],
  ) {}
}
