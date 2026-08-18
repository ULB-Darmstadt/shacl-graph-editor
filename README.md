# SHACL Graph Editor

SHACL Graph Editor is a browser-based editor for the workflow:

1. import or create SHACL profiles
2. inspect, review and edit shapes on a graph canvas
3. export SHACL again

## [OPEN DEMO](https://ulb-darmstadt.github.io/shacl-graph-editor/#/editor)

## Features

- Start from local Turtle files or search profiles from the NFDI4ING Metadata Profile Service.
- Work visually on a graph canvas with profiles, inherited profiles, properties, and SHACL relations.
- Edit profile metadata and property details in the side panel.
- Create and adjust profile connections such as `sh:node`, `sh:or`, and `sh:qualifiedvalueshape`.
- Move properties between profiles or reorder them within a profile by drag and drop.
- Use Review mode to find missing required metadata, incomplete property definitions, and other profile quality issues.
- Jump from review findings directly to the affected profile or property on the canvas.
- Preview shapes with `@ulb-darmstadt/shacl-form`.
- Export the current editor state as SHACL/Turtle.

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
  shacl-icon.svg        app icon and branding
```

## Architecture

- `domain/profiles` contains the editor data model.
- `infrastructure/shacl` contains SHACL import and export logic.
- `application/profiles` coordinates editor mutations and workflows.
- `presentation/features/editor` contains the graph editor UI.

## License

MIT. See [LICENSE](LICENSE).
created by Roger Winkler, ULB Darmstadt