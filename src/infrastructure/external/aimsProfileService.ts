const AIMS_API = 'https://pg4aims.ulb.tu-darmstadt.de/AIMS/application-profiles'

export interface AimsProfile {
  base_url: string
  created?: string
  creator?: string
  description?: string
  mimeType?: string
  name: string
  state?: string
}

export async function loadAimsProfiles(): Promise<AimsProfile[]> {
  const response = await fetch(AIMS_API, {
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`AIMS profile search failed: ${response.status}`)
  }

  const data = await response.json() as unknown
  const profiles: AimsProfile[] = Array.isArray(data)
    ? data.filter((entry): entry is AimsProfile => typeof entry === 'object' && entry !== null && 'base_url' in entry && 'name' in entry)
    : []

  return profiles.sort((left, right) => left.name.localeCompare(right.name))
}

export async function fetchAimsProfileTurtle(profile: AimsProfile): Promise<string> {
  const response = await fetch(profile.base_url, {
    headers: {
      accept: 'text/turtle, text/plain;q=0.9, */*;q=0.1',
    },
  })

  if (!response.ok) {
    throw new Error(`AIMS profile download failed: ${response.status}`)
  }

  return response.text()
}