# Memory Seek - Frontend (寻忆)

A photo sharing platform frontend built with Vue 3, TypeScript, and Vite.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Vue 3](https://vuejs.org/) (Composition API + `<script setup>`) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Build Tool | [Vite](https://vite.dev/) |
| State Management | [Pinia](https://pinia.vuejs.org/) |
| Router | [Vue Router](https://router.vuejs.org/) |
| HTTP Client | [Axios](https://axios-http.com/) |
| Icons | [Lucide Vue](https://lucide.dev/) |
| Utilities | [VueUse](https://vueuse.org/), [Day.js](https://day.js.org/) |
| Styling Utilities | [class-variance-authority](https://cva.style/) |
| Linting | [Oxlint](https://oxc.rs/) |
| Formatting | [Prettier](https://prettier.io/) |
| Package Manager | [pnpm](https://pnpm.io/) |

## Project Structure

```
src/
├── components/         # Reusable UI components
│   ├── _shared/        # Shared/common components
│   ├── actions/        # Action buttons, menus, etc.
│   ├── base/           # Base primitives (button, input, etc.)
│   ├── data/           # Data display components
│   ├── feedback/       # Toast, modal, etc.
│   ├── form/           # Form components
│   └── photo/          # Photo-specific components
├── composables/        # Shared composition functions
├── layouts/            # App layout (drawer, top bar, shell)
├── router/             # Route definitions with guards
├── stores/             # Pinia stores
│   ├── auth.ts         # Authentication state
│   ├── collection.ts   # Collection management
│   ├── theme.ts        # Theme preferences
│   └── user.ts         # User cache
├── styles/             # Global CSS & variables
├── views/              # Page views
├── App.vue             # Root component
└── main.ts             # App entry point
```

## Pages

| Route | Name | Description |
|-------|------|-------------|
| `/login` | Login | User login |
| `/register` | Register | User registration |
| `/photos` | Photo Wall | Waterfall-style photo browsing |
| `/likes` | Likes | Liked photos |
| `/collections` | Collections | Photo collection management |
| `/collections/:id` | Collection Detail | Photos in a specific collection |
| `/profile` | Profile | User profile |

## Prerequisites

- **Node.js** `^22.18.0` or `>=24.12.0`
- **pnpm** (latest)

## Getting Started

```bash
# Install dependencies
pnpm install

# Create environment file
cp .env.example .env
# Edit .env and set VITE_API_BASE_URL to your API server URL

# Start development server
pnpm dev
```

The dev server starts at `http://localhost:5173` by default. Hot Module Replacement (HMR) is enabled out of the box.

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Type-check and build for production |
| `pnpm build-only` | Build for production without type-check |
| `pnpm preview` | Preview production build locally |
| `pnpm type-check` | Run `vue-tsc` type checking |
| `pnpm lint` | Lint with Oxlint |
| `pnpm format` | Format code with Prettier |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | Yes | Base URL of the Memory Seek API (see `.env.example`) |

## CI/CD

- **CI**: Runs lint, type-check, and build on push/PR (`.github/workflows/ci.yml`)
- **Release**: Auto-builds and publishes via `semantic-release` on main branch pushes (`.github/workflows/release.yml`)

## Related

- [memory-seek-api](https://github.com/memory-seek/memory-seek-api) — API client library (workspace dependency)
