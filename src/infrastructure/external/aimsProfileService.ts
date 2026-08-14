const AIMS_API = 'https://aims-backend.tools.coscine.dev/AIMS'
const AIMS_PROFILE_SEARCH_LANGUAGES = ['EN', 'DE'] as const

export interface AimsProfile {
  base_url: string
  created?: string
  creator?: string
  description?: string
  definition?: string | null
  mimeType?: string
  name: string
  state?: string | number
}

function isAimsProfile(entry: unknown): entry is AimsProfile {
  return typeof entry === 'object'
    && entry !== null
    && 'base_url' in entry
    && typeof entry.base_url === 'string'
    && 'name' in entry
    && typeof entry.name === 'string'
}

async function fetchAimsJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`AIMS request failed: ${response.status}`)
  }

  return response.json() as Promise<unknown>
}

export async function loadAimsProfiles(): Promise<AimsProfile[]> {
  const responses = await Promise.all(AIMS_PROFILE_SEARCH_LANGUAGES.map(async language => {
    const url = `${AIMS_API}/application-profiles/?query=&language=${language}&includeDefinition=false`
    return fetchAimsJson(url)
  }))

  const profilesByBaseUrl = new Map<string, AimsProfile>()
  for (const response of responses) {
    if (!Array.isArray(response)) continue
    for (const entry of response) {
      if (!isAimsProfile(entry) || profilesByBaseUrl.has(entry.base_url)) continue
      profilesByBaseUrl.set(entry.base_url, entry)
    }
  }

  return Array.from(profilesByBaseUrl.values())
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function fetchAimsProfileTurtle(profile: AimsProfile): Promise<string> {
  const encodedBaseUrl = encodeURIComponent(profile.base_url)
  const url = `${AIMS_API}/application-profiles/${encodedBaseUrl}?includeDefinition=true`
  const data = await fetchAimsJson(url)

  if (!isAimsProfile(data) || typeof data.definition !== 'string' || data.definition.length === 0) {
    throw new Error('AIMS profile download failed: missing Turtle definition')
  }

  return data.definition
}