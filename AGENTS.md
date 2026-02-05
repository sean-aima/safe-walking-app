# Repository Guidelines

## Project Structure
- `index.html` is the Vite entry point with `div#root`.
- `src/` contains the React app. `src/main.jsx` bootstraps React and imports `src/styles.css`. `src/App.jsx` holds the main UI and map logic.
- `vite.config.js` configures the Vite build.
- `app.js` and `styles.css` at the repo root appear to be legacy/standalone assets; confirm usage before editing.
- Generated outputs: `node_modules/` for dependencies and `dist/` for production builds.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server with hot reload.
- `npm run build` builds production assets into `dist/`.
- `npm run preview` serves the built `dist/` locally for verification.

## Coding Style & Naming Conventions
- JavaScript/JSX uses 2-space indentation, semicolons, and double quotes (match existing `src/App.jsx`).
- Naming: `PascalCase` for components (`App`), `camelCase` for functions/variables, and `UPPER_SNAKE_CASE` for constants (e.g., `INCIDENT_TYPES`).
- CSS uses kebab-case class names. Prefer adding styles to `src/styles.css`.

## Testing Guidelines
- No automated test framework or coverage targets are configured.
- If adding tests, keep them close to the code (e.g., `src/**/__tests__/*.test.jsx`) and add matching `package.json` scripts.

## Commit & Pull Request Guidelines
- Git history currently has a single commit message ("initial push"), so no established convention exists yet.
- Use short, imperative subjects (e.g., "Add report filter").
- PRs should describe user-facing changes, list new dependencies, and include screenshots for UI updates.

## Configuration & Secrets
- Supabase credentials are loaded via Vite environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). See `.env.example`.
- Keep real credentials in a local `.env` file and never commit them.
