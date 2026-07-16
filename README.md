# SHACL Graph Editor

SHACL Graph Editor is a browser-based editor for the workflow:

1. import SHACL profiles
2. inspect and edit shapes on a graph canvas
3. export SHACL again

## (DEMO)[https://ulb-darmstadt.github.io/shacl-graph-editor/#/editor]

## Features

- Import SHACL from local Turtle files
- Load profiles from the Metadata Profile Service
- Resolve `owl:imports`
- Visualize linked `sh:node` relations on a canvas
- Edit profiles and fields in the sidebar
- Preview shapes with `@ulb-darmstadt/shacl-form`
- Export the current editor state as SHACL/Turtle

## Tech Stack

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- PrimeVue
- Vue Flow
- Dagre
- rdflib

## Development

Recommended runtime: Node.js 20 or newer.

```bash
npm install
npm run dev
npm run type-check
npm run lint
npm run build
```

Local development usually runs at:

```text
http://localhost:5173/
```

## Repository Structure

```text
src/
  app/                  app shell and router wiring
  application/          editor state and application services
  assets/               bundled example and showcase profiles
  domain/profiles/      profile, shape, and field domain model
  infrastructure/       SHACL parsing, serialization, external profile access
  presentation/         editor UI, dialogs, canvas, inspector, preview
  shared/               shared RDF helpers and global styles
public/
  dfgfo.ttl             subject heading source
  shacl-logo.png        app branding
```

## Architecture

- `domain/profiles` contains the clean editor data model.
- `infrastructure/shacl` contains SHACL import and export logic.
- `application/profiles` coordinates editor mutations and workflows.
- `presentation/features/editor` contains the graph editor UI.

This keeps the intended workflow explicit in the repository:
import SHACL -> edit in the graph editor -> export SHACL.

## Deployment

The app is a static SPA and can be deployed to GitHub Pages.

The included GitHub Actions workflow:

- installs dependencies with `npm ci`
- runs type checking
- builds the app
- publishes `dist/` to GitHub Pages

In production, the Vite base path is derived from the GitHub repository name,
so the same build can be deployed under the target repository path.

## License

MIT. See [LICENSE](LICENSE).
