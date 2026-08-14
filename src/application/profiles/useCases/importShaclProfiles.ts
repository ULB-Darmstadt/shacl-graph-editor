import type { ApplicationProfile, ShaclProfile } from '@/domain/profiles'
import { resolveProfileImportsRecursive, type ResolveResult } from '@/infrastructure/shacl/profileImportResolver'
import { parseShaclProfile, parseShaclProfiles } from '@/infrastructure/shacl/shaclProfileParser'

export async function importUploadedProfileFile(file: File, iriHint?: string): Promise<ShaclProfile[]> {
  const text = await file.text()
  if (iriHint) return [parseShaclProfile(text, file.name, 'uploaded', iriHint)]
  return parseShaclProfiles(text, file.name, 'uploaded')
}

export function importProfileFromTurtle(
  turtle: string,
  source: string,
  origin: ShaclProfile['origin'],
  iriHint?: string,
): ShaclProfile {
  return parseShaclProfile(turtle, source, origin, iriHint)
}

export async function resolveImportedProfiles(applicationProfile: ApplicationProfile): Promise<ResolveResult> {
  return resolveProfileImportsRecursive(applicationProfile)
}
