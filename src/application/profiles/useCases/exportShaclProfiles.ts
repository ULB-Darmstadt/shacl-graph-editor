import type { ShaclProfile } from '@/domain/profiles'
import { downloadProfilesAsTurtle as downloadProfilesAsTurtleFile } from '@/infrastructure/shacl/shaclProfileSerializer'

export function downloadProfilesAsTurtle(profiles: readonly ShaclProfile[], baseName?: string): string {
  return downloadProfilesAsTurtleFile(profiles, baseName)
}
