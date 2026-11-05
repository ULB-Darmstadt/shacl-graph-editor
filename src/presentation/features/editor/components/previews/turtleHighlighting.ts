export type TurtleTokenKind = 'plain' | 'comment' | 'string' | 'iri' | 'keyword' | 'prefix' | 'number' | 'punctuation'

export interface TurtleToken {
  text: string
  kind: TurtleTokenKind
}

/** Lightweight presentation-only highlighting; source is always rendered as text. */
export function highlightTurtleLines(source: string): TurtleToken[][] {
  const pattern = /#[^\r\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|<[^>\r\n]*>|(?:@prefix|@base|PREFIX|BASE)\b|(?:[A-Za-z_][\w-]*)?:[\w.-]*|\b(?:true|false|a)\b|[+-]?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|[;.,[\]()]/g
  const lines: TurtleToken[][] = [[]]
  let cursor = 0

  function append(text: string, kind: TurtleTokenKind): void {
    text.split('\n').forEach((part, index) => {
      if (index > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ text: part, kind })
    })
  }

  for (const match of source.matchAll(pattern)) {
    append(source.slice(cursor, match.index), 'plain')
    const text = match[0]
    let kind: TurtleTokenKind = 'punctuation'
    if (text.startsWith('#')) kind = 'comment'
    else if (text.startsWith('"') || text.startsWith("'")) kind = 'string'
    else if (text.startsWith('<')) kind = 'iri'
    else if (/^(?:@prefix|@base|PREFIX|BASE|true|false|a)$/.test(text)) kind = 'keyword'
    else if (text.includes(':')) kind = 'prefix'
    else if (/^[+-]?\d/.test(text)) kind = 'number'
    append(text, kind)
    cursor = match.index + text.length
  }
  append(source.slice(cursor), 'plain')
  return lines
}
