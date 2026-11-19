import createProfileAnimation from '@/assets/getting-started/01_CreateProfile.gif?url'
import addFieldsAnimation from '@/assets/getting-started/02_AddFields.gif?url'
import connectProfilesAnimation from '@/assets/getting-started/03_ConnectProfiles.gif?url'
import addConstraintsAnimation from '@/assets/getting-started/04_AddConstrains.gif?url'
import testProfileFormAnimation from '@/assets/getting-started/05_TestProfileForm.gif?url'
import mpsAnimation from '@/assets/getting-started/06_MPS.gif?url'
import createProfilePoster from '@/assets/getting-started/01_CreateProfile.webp?url'
import addFieldsPoster from '@/assets/getting-started/02_AddFields.webp?url'
import connectProfilesPoster from '@/assets/getting-started/03_ConnectProfiles.webp?url'
import addConstraintsPoster from '@/assets/getting-started/04_AddConstrains.webp?url'
import testProfileFormPoster from '@/assets/getting-started/05_TestProfileForm.webp?url'
import mpsPoster from '@/assets/getting-started/06_MPS.webp?url'

/** Vite-managed asset URLs also work under a repository deployment base path. */
export const gettingStartedSlides = [
  {
    id: 'create',
    label: 'Create',
    headline: 'Start with a metadata profile',
    description: 'Create and name a profile to define the information you want to describe.',
    animation: createProfileAnimation,
    poster: createProfilePoster,
  },
  {
    id: 'fields',
    label: 'Add fields',
    headline: 'Add the fields your profile needs',
    description: 'Add fields to your profile to describe individual pieces of information.',
    animation: addFieldsAnimation,
    poster: addFieldsPoster,
  },
  {
    id: 'connect',
    label: 'Connect',
    headline: 'Connect profiles to describe richer data',
    description: 'Connect a field to another profile to reuse its structure for related information.',
    animation: connectProfilesAnimation,
    poster: connectProfilesPoster,
  },
  {
    id: 'constraints',
    label: 'Set rules',
    headline: 'Give each field a clear rule',
    description: 'Set field constraints to specify which values are allowed and how often they can occur.',
    animation: addConstraintsAnimation,
    poster: addConstraintsPoster,
  },
  {
    id: 'preview',
    label: 'Test form',
    headline: 'Try the form your profile creates',
    description: 'Open the form preview and enter example values to try out your profile.',
    animation: testProfileFormAnimation,
    poster: testProfileFormPoster,
  },
  {
    id: 'mps',
    label: 'Reuse',
    headline: 'Discover existing metadata profiles',
    description: 'Find and load profiles from the Metadata Profile Service to reuse existing definitions.',
    animation: mpsAnimation,
    poster: mpsPoster,
  },
] as const
