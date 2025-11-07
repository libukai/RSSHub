# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RSSHub** is the world's largest RSS aggregation network with 5000+ route handlers that convert web content into standardized RSS feeds. The architecture is built on Hono (lightweight web framework), TypeScript (ESNext strict mode), and Node.js ≥22.

## 🚨 CRITICAL: Route Development Workflow

**When the user requests to create, modify, or work with RSSHub routes, ALWAYS use the `rsshub-route-creator` skill.**

**Trigger conditions:**
- User mentions "create route", "new route", "add route"
- User wants to convert a website to RSS
- User asks about route implementation
- User mentions specific websites to add to RSSHub
- Any route development or modification task

**How to invoke:**
```
Use Skill tool with: rsshub-route-creator
```

**Why this is critical:**
- The skill contains comprehensive route development guidance
- Includes all 4 data fetching methods (API, RSS XML, HTML, Puppeteer)
- Provides complete templates and reference documentation
- Ensures compliance with RSSHub's strict ESLint rules
- Contains advanced patterns (utility abstractions, RSS cleaning)

**DO NOT attempt to create routes without the skill** - it contains essential non-obvious patterns and project-specific requirements that are not in general knowledge.

## Essential Commands

### Development
```bash
pnpm dev                    # Start development server with hot reload (port 1200)
pnpm dev:cache              # Production cache mode for testing caching behavior
```

### Code Quality (CRITICAL before commits)
```bash
pnpm format                 # Auto-fix formatting + ESLint (MUST run before commit)
pnpm lint                   # Run ESLint only
pnpm format:check           # Verify formatting without changes
```

### Testing
```bash
pnpm test                   # Run all tests + format checks
pnpm vitest                 # Run Vitest in development mode
pnpm vitest:watch           # Run Vitest in watch mode
pnpm vitest:coverage        # Run tests with coverage report
pnpm vitest:fullroutes      # Test all route examples (comprehensive)
```

### Build & Production
```bash
pnpm build                  # Build for production
pnpm start                  # Start production server (requires build first)
```

### Accessing Routes
```
http://localhost:1200/<namespace>/<path>
http://localhost:1200/<namespace>/<path>?limit=10&format=json&debug=1
```

## Architecture

### Core Components

**Hono Framework Pipeline:**
```
Request → Middleware Chain → Route Handler → RSS Generation → Response
```

**Middleware layers** (applied in order):
- `lib/middleware/trace.ts` - OpenTelemetry tracing
- `lib/middleware/logger.ts` - Request logging
- `lib/middleware/access-control.ts` - API key validation
- `lib/middleware/cache.ts` - Route-level caching (Redis/memory)
- `lib/middleware/parameter.ts` - Query parameter processing
- `lib/middleware/header.ts` - Response headers
- `lib/middleware/anti-hotlink.ts` - Prevent image hotlinking
- `lib/middleware/sentry.ts` - Error reporting
- `lib/middleware/debug.ts` - Debug mode utilities

### Route Structure

Each route is a namespace under `lib/routes/<namespace>/`:

```
lib/routes/<namespace>/
├── namespace.ts          # Required: metadata (name, url, categories, lang)
├── index.ts             # Main route handler (exports route object)
├── utils.ts             # Optional: shared utilities for this namespace
└── <feature>.ts         # Additional route handlers
```

**Route Handler Pattern:**
```typescript
import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';

export const route: Route = {
    path: '/path/:param',           // Hono route pattern
    name: 'Human-readable Name',
    maintainers: ['github-username'],
    handler,
    categories: ['category'],       // See lib/types.ts for valid categories
    example: '/namespace/path/example',
    parameters: { param: 'Description' },
    features: {
        requireConfig: false,       // Needs environment variables?
        requirePuppeteer: false,    // Needs browser automation?
        antiCrawler: false,         // Has anti-crawler measures?
    },
};

async function handler(ctx) {
    // ctx.req.param('param') - path parameters
    // ctx.req.query('limit') - query parameters

    return {
        title: 'Feed Title',
        link: 'https://example.com',
        item: [],  // Array of DataItem objects
    };
}
```

### Key Directories

- **`lib/routes/`** - 5000+ route implementations (namespace-based organization)
- **`lib/utils/`** - Shared utilities:
  - `cache/` - Caching layer (Redis/memory)
  - `got.ts` - HTTP client wrapper (based on ofetch)
  - `parse-date.ts` - Date parsing utilities
  - `puppeteer.ts` - Browser automation
  - `jtks/` - WeChat RSS cleaning utilities (example of utility abstraction)
- **`lib/middleware/`** - Request/response middleware
- **`lib/types.ts` - Core TypeScript interfaces** (`Route`, `DataItem`, `Data`, `Category`)
- **`lib/config.ts`** - Configuration management (environment variables)

### Configuration

Environment variables are loaded via `dotenv`. Key config areas:
- **Cache:** Type (memory/redis), TTL settings
- **Network:** Proxy configuration, request timeout/retry
- **Cluster:** Multi-process support (cluster mode)
- **Telemetry:** OpenTelemetry, Sentry integration
- **Access Control:** API key validation

## Critical ESLint Rules

These rules are STRICTLY ENFORCED and will cause CI to fail:

### 1. Cheerio Operations - MUST use .toArray()
```typescript
// ❌ WRONG - Direct .map() on Cheerio
$('.item').map((index, item) => { ... })

// ✅ CORRECT - Convert to array first
$('.item').toArray().map((item) => { ... })
```

**Reason:** ESLint rule prevents direct Cheerio iteration (line 105-110 in eslint.config.mjs)

### 2. Path Aliases - MUST use @/ prefix
```typescript
// ❌ WRONG - Relative imports
import cache from '../../utils/cache';

// ✅ CORRECT - Path alias
import cache from '@/utils/cache';
```

**Configured in:** `tsconfig.json` (`"@/*": ["./lib/*"]`)

### 3. Parameter Reassignment - MUST use new variable
```typescript
// ❌ WRONG - Reassigning parameter
.map((item) => { item = $(item); })

// ✅ CORRECT - New variable
.map((item) => { const $item = $(item); })
```

### 4. Error Handling - MUST handle errors appropriately
```typescript
// ❌ WRONG - Swallowing errors
.catch(() => null)
.catch(() => undefined)

// ✅ CORRECT - Handle or log errors
.catch((error) => {
    logger.error(error);
    throw error;
})
```

### 5. No console.log - Use logger
```typescript
// ❌ WRONG
console.log('Debug message');

// ✅ CORRECT
import logger from '@/utils/logger';
logger.info('Debug message');
```

## TypeScript Configuration

- **Target:** ESNext
- **Module System:** ESNext with bundler resolution
- **JSX:** React JSX (for Hono JSX components)
- **Strict Mode:** Enabled (except `noImplicitAny: false`)
- **Path Mapping:** `@/*` → `lib/*`

**Important:** All route files MUST use `.ts` extension. The project uses `tsx` for development execution.

## Data Fetching Patterns

### Priority Order
1. **JSON API** (★★★★★) - Use `got` from `@/utils/got`
2. **RSS XML** (★★★★) - Use Cheerio with `xmlMode: true`
3. **HTML Parsing** (★★★) - Use Cheerio with default mode
4. **Puppeteer** (★) - Last resort, MUST set `requirePuppeteer: true`

### Caching Pattern (MANDATORY for detail pages)
```typescript
const items = await Promise.all(
    list.map((item) =>
        cache.tryGet(item.link, async () => {
            const { data } = await got(item.link);
            // Process data
            return item;
        })
    )
);
```

**Why:** Prevents duplicate fetches, respects rate limits, improves performance.

### RSS XML Processing (Two-Stage Pattern)
```typescript
// Stage 1: Parse RSS (xmlMode: true)
const $ = load(rssXml, { xmlMode: true });
const descriptionHtml = $item.find('description').text();  // Extract CDATA

// Stage 2: Clean HTML (default mode)
const $desc = load(descriptionHtml);  // No xmlMode!
$desc('.ads').remove();
const cleaned = $desc('body').html() || '';
```

**Critical:** Always use `.text()` to extract CDATA content, NOT `.html()`

## Utility Abstraction Pattern

When 3+ routes share identical logic, create reusable utilities. See `lib/utils/jtks/` for example:

**Structure:**
```
lib/utils/<utility-name>/
├── types.ts              # TypeScript interfaces
├── <processor>.ts        # Core processing logic
└── <engine>.ts           # Generic engine (e.g., HTML cleaner)
```

**Route file becomes configuration:**
```typescript
const config: UtilityConfig = {
    name: 'route-name',
    rules: [/* declarative rules */],
};

async function handler(ctx) {
    return await processWithUtility(config, ctx);
}
```

**Benefits:** Code reuse, declarative configuration, type safety, easier maintenance.

## Common Pitfalls

1. **Not caching detail fetches** - Always use `cache.tryGet()` for article/detail pages
2. **Returning string dates** - MUST return `Date` objects from `parseDate()`, not strings
3. **Vague timezones** - Use `timezone(parseDate(date), +offset)` where offset is SOURCE timezone
4. **Undeclared Puppeteer** - If using `puppeteer`, MUST set `features.requirePuppeteer: true`
5. **Null-unsafe Cheerio** - Always provide defaults: `.html() || ''`, `.attr('href') || ''`
6. **Hardcoded limits** - Support `limit` query parameter: `ctx.req.query('limit')`
7. **Missing namespace.ts** - REQUIRED file for every route directory

## Testing Routes

### Manual Testing
```bash
# Start dev server
pnpm dev

# Test route (replace namespace/path)
curl -s "http://localhost:1200/namespace/path?limit=2"

# Validate RSS output
curl -s "http://localhost:1200/namespace/path" | grep -E "<title>|<pubDate>|<link>"

# Test with JSON format
curl -s "http://localhost:1200/namespace/path?format=json" | jq
```

### Route Example Requirements
- The `example` field MUST be a working path
- It will be tested in CI via `pnpm vitest:fullroutes`
- Example should demonstrate the route with realistic parameters

## Package Manager

**MUST use pnpm** (version 10.20.0+). The project enforces this via `packageManager` field in `package.json`.

```bash
# Never use npm or yarn
pnpm install           # Install dependencies
pnpm add <package>     # Add dependency
pnpm add -D <package>  # Add dev dependency
```

## Valid Categories

Must use one of these values (from `lib/types.ts`):
- `popular`, `social-media`, `new-media`, `traditional-media`
- `bbs`, `blog`, `programming`, `design`, `live`
- `multimedia`, `picture`, `anime`, `program-update`
- `university`, `forecast`, `travel`, `shopping`, `game`
- `reading`, `government`, `study`, `journal`, `finance`, `other`

## Development Workflow

1. **Before starting:** Run `pnpm dev` (port 1200)
2. **Create route:** Follow structure in `lib/routes/<namespace>/`
3. **Test locally:** Access via `http://localhost:1200/namespace/path`
4. **Before commit:** Run `pnpm format` (auto-fixes most issues)
5. **Verify:** Run `pnpm lint` and `pnpm test`
6. **Never commit:** Without running `pnpm format` first

## Return Data Format

### Feed Level
```typescript
return {
    title: string,              // Required
    link: string,               // Required
    item: DataItem[],           // Required
    description?: string,       // Strongly recommended
    image?: string,
    language?: string,          // e.g., 'en', 'zh-CN'
    allowEmpty?: boolean,       // Allow empty feed (default false)
    ttl?: number,               // Cache TTL (seconds)
};
```

### Item Level (DataItem)
```typescript
{
    title: string,              // Required
    link?: string,              // Strongly recommended
    description?: string,       // HTML content
    pubDate?: Date,             // MUST be Date object (use parseDate())
    author?: string,
    category?: string[],
    guid?: string,              // Unique identifier
    image?: string,
}
```

## Documentation

- **Official Docs:** https://docs.rsshub.app/
- **Contribution Guide:** https://docs.rsshub.app/joinus/
- **Route Examples:** Browse `lib/routes/` directory
- **Hono Docs:** https://hono.dev/
- **Cheerio Docs:** https://cheerio.js.org/
