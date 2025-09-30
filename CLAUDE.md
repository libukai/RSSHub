# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RSSHub** is the world's largest RSS network that aggregates content from thousands of sources. The codebase contains over 5,000 route handlers that transform various web content into standardized RSS feeds.

- **Framework**: Hono (lightweight web framework)
- **Language**: TypeScript (ESNext with strict mode)
- **Runtime**: Node.js ≥22
- **Package Manager**: pnpm (required, version 10.17.1+)
- **Architecture**: Middleware-based request pipeline with dynamic route registration

## Essential Commands

### Development
```bash
# Start development server with hot reload and debugging
pnpm dev

# Start with production cache settings (useful for testing cache behavior)
pnpm dev:cache
```

### Testing
```bash
# Run all tests with coverage (includes format check)
pnpm test

# Run tests in watch mode
pnpm vitest:watch

# Run only vitest tests with coverage
pnpm vitest:coverage

# Run full routes test (tests all route examples)
pnpm vitest:fullroutes
```

### Building
```bash
# Build the project (generates routes and compiles TypeScript)
pnpm build

# Build for Vercel deployment
pnpm build:vercel

# Build documentation
pnpm build:docs
```

### Code Quality
```bash
# Format and fix all code
pnpm format

# Check formatting without fixing
pnpm format:check

# Run ESLint only
pnpm lint

# Format staged files (runs automatically via husky)
pnpm format:staged
```

### Production
```bash
# Start production server (requires build first)
pnpm start
```

## Architecture & Code Structure

### Request Flow
1. **app.ts** → **app-bootstrap.tsx**: Entry point that sets up Hono app with middleware chain
2. **Middleware Pipeline** (order matters):
   - `trimTrailingSlash` → `compress` → `jsxRenderer`
   - `logger` → `trace` → `sentry` → `accessControl`
   - `debug` → `template` → `header` → `antiHotlink`
   - `parameter` → `cache`
3. **Route Registry**: Dynamic route registration from `lib/routes/*` directories
4. **API Routes**: OpenAPI-compliant endpoints in `lib/api/`

### Route Structure

Each route is organized in `lib/routes/<namespace>/`:

```
lib/routes/<namespace>/
├── namespace.ts          # Required: Metadata (name, url, description, lang)
├── index.ts             # Main route handler (or multiple route files)
├── utils.ts             # Optional: Shared utilities for this namespace
├── templates/           # Optional: Art-template views
└── <feature>.ts         # Additional route handlers
```

## 📝 Creating a New Route - Complete Guide

### Step 1: Create Namespace File

**File:** `lib/routes/<namespace>/namespace.ts`

```typescript
import type { Namespace } from '@/types';

export const namespace: Namespace = {
    name: 'Site Name',              // English name
    url: 'example.com',             // Domain (without protocol)
    description: 'Optional description with **markdown** support',
    categories: ['traditional-media'], // Optional: default category for all routes
    lang: 'en',                     // ISO 639-1 language code

    // Optional: Chinese translation
    zh: {
        name: '网站中文名',
        description: '可选的中文描述',
        categories: ['traditional-media'],
        lang: 'zh-CN',
    },
};
```

### Step 2: Create Route Handler

**File:** `lib/routes/<namespace>/index.ts` (or specific feature file)

#### Complete Route Structure with All Fields

```typescript
import { Route, ViewType } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    // REQUIRED FIELDS
    path: '/issue/:user/:repo/:state?/:labels?',  // Hono route pattern
    name: 'Repo Issues',                           // Human-readable name
    maintainers: ['github-username'],              // Your GitHub username(s)
    handler,                                       // Handler function reference

    // STRONGLY RECOMMENDED
    categories: ['programming'],                   // Route category (see list below)
    example: '/github/issue/DIYgod/RSSHub/open',  // Must be a working example!

    // PARAMETER DOCUMENTATION (if route has params)
    parameters: {
        user: 'GitHub username',
        repo: 'GitHub repo name',
        state: {
            description: 'Issue state',
            default: 'open',                       // Optional: specify default
            options: [                             // Optional: for dropdown UI
                { value: 'open', label: 'Open' },
                { value: 'closed', label: 'Closed' },
                { value: 'all', label: 'All' },
            ],
        },
        labels: 'Comma separated label names (optional)',
    },

    // FEATURES DECLARATION
    features: {
        requireConfig: false,      // Set true if needs API keys/config
        requirePuppeteer: false,   // Set true if uses browser automation
        antiCrawler: false,        // Set true if site has anti-bot measures
        supportBT: false,          // Set true if provides BitTorrent feeds
        supportPodcast: false,     // Set true if provides podcast feeds
        supportScihub: false,      // Set true if integrates Sci-Hub
    },

    // OPTIONAL FIELDS
    url: 'github.com',            // Override namespace URL if different
    view: ViewType.Articles,      // UI display hint (Articles, Notifications, etc.)
    description: 'Detailed **markdown** description here',

    // RSSHUB RADAR INTEGRATION (for browser extension)
    radar: [
        {
            source: ['github.com/:user/:repo/issues'],
            target: '/issue/:user/:repo',
        },
    ],
};

// Handler function - async required
async function handler(ctx) {
    // Get route parameters (from URL path)
    const user = ctx.req.param('user');
    const repo = ctx.req.param('repo') || 'RSSHub';  // with default
    const state = ctx.req.param('state');

    // Get query parameters (?limit=10)
    const limit = ctx.req.query('limit')
        ? Number.parseInt(ctx.req.query('limit'), 10)
        : 20;

    // Fetch data (see methods below)
    const data = await fetchData(user, repo, state);

    // Return RSS feed data
    return {
        title: `${user}/${repo} Issues`,
        description: `GitHub Issues for ${user}/${repo}`,
        link: `https://github.com/${user}/${repo}/issues`,
        image: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
        item: data.map(item => ({
            title: item.title,
            link: item.url,
            description: item.body_html,              // HTML content
            author: item.user.login,
            pubDate: parseDate(item.created_at),      // Must be Date object
            category: item.labels.map(l => l.name),   // Array of strings
            guid: item.url,                           // Unique identifier
        })),

        // Optional feed-level fields
        allowEmpty: true,        // Allow empty feeds (don't throw error)
        language: 'en',          // Feed language
        ttl: 3600,              // Time-to-live in seconds
    };
}
```

#### Hono Route Path Patterns

Hono uses a flexible routing syntax:

```typescript
// Named parameters (required)
path: '/user/:id'                    // Matches: /user/123
path: '/post/:year/:month/:day'      // Matches: /post/2024/01/01

// Optional parameters (with ?)
path: '/issue/:user/:repo/:state?'   // Matches: /issue/a/b or /issue/a/b/open

// Wildcard (catch-all)
path: '/docs/*'                      // Matches: /docs/anything/here
path: '/:language?/*'                // Optional param + wildcard

// Regular expression
path: '/post/:id{[0-9]+}'           // Only matches numeric IDs
```

Access parameters in handler:
```typescript
const id = ctx.req.param('id');          // Path parameter
const limit = ctx.req.query('limit');    // Query parameter (?limit=10)
```

### Step 3: Choose Data Fetching Method

## 🔄 Three Data Fetching Methods

### Method 1: API-Based (RECOMMENDED ⭐)

**Use when:** Site provides a public or discoverable API

**Advantages:** Fast, reliable, structured data, less likely to break

```typescript
import { Route } from '@/types';
import ofetch from '@/utils/ofetch';  // Recommended for new routes
import got from '@/utils/got';        // Also available (got-compatible wrapper)
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/issue/:user/:repo',
    name: 'GitHub Issues via API',
    maintainers: ['yourname'],
    handler,
};

async function handler(ctx) {
    const { user, repo } = ctx.req.param();

    // Method A: Using ofetch (modern, recommended)
    const data = await ofetch(`https://api.github.com/repos/${user}/${repo}/issues`, {
        headers: {
            accept: 'application/vnd.github.html+json',
            authorization: `token ${config.github.access_token}`, // if needed
        },
        query: {          // Automatically serialized to query string
            state: 'open',
            per_page: 20,
        },
    });

    // Method B: Using got (backward compatible)
    const response = await got({
        method: 'get',
        url: `https://api.github.com/repos/${user}/${repo}/issues`,
        headers: {
            accept: 'application/vnd.github.html+json',
        },
        searchParams: {   // Use searchParams for query strings
            state: 'open',
            per_page: 20,
        },
    });
    const data = response.data;

    return {
        title: `${user}/${repo} Issues`,
        link: `https://github.com/${user}/${repo}/issues`,
        item: data.map(item => ({
            title: item.title,
            link: item.html_url,
            description: item.body_html,
            pubDate: parseDate(item.created_at),
            author: item.user.login,
        })),
    };
}
```

**POST Request Example:**
```typescript
// Using ofetch
const data = await ofetch('https://api.example.com/graphql', {
    method: 'POST',
    body: {
        query: '{ users { name } }',
    },
});

// Using got
const { data } = await got({
    method: 'post',
    url: 'https://api.example.com/data',
    json: {              // Auto-serialized to JSON
        key: 'value',
    },
});
```

### Method 2: HTML Parsing (COMMON)

**Use when:** No API available, need to scrape HTML

**Advantages:** Works for most websites, no browser overhead

```typescript
import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

export const route: Route = {
    path: '/:category?',
    name: 'News Category',
    maintainers: ['yourname'],
    handler,
};

async function handler(ctx) {
    const category = ctx.req.param('category') || 'all';
    const limit = ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit'), 10) : 20;

    // Step 1: Fetch list page
    const { data: response } = await got({
        method: 'post',
        url: 'https://www.cna.com.tw/cna2018api/api/WNewsList',
        json: {
            category: category,
            pagesize: limit,
            pageidx: 1,
        },
    });

    // Parse API response to get article URLs
    const list = response.ResultData.Items.slice(0, limit).map(item => ({
        title: item.HeadLine,
        link: item.PageUrl,
        pubDate: timezone(parseDate(item.CreateTime), +8),  // Handle timezone!
    }));

    // Step 2: Fetch full content for each article (with caching!)
    const items = await Promise.all(
        list.map(item =>
            cache.tryGet(item.link, async () => {
                const { data } = await got(item.link);
                const $ = load(data);  // Load HTML into Cheerio

                // Remove unwanted elements
                $('div.SubscriptionInner').remove();
                $('.moreArticle').remove();

                // Extract content
                const topImage = $('.fullPic').html();
                const content = $('.paragraph').eq(0).html();

                // Extract metadata from page
                item.description = (topImage || '') + content;
                item.category = $("meta[property='article:tag']")
                    .toArray()
                    .map(elem => $(elem).attr('content'));

                return item;
            })
        )
    );

    return {
        title: 'News Feed',
        link: 'https://www.cna.com.tw',
        item: items,
    };
}
```

**Cheerio Tips:**
```typescript
const $ = load(html);

// Selecting elements
$('.class')                    // By class
$('#id')                      // By ID
$('div.class > p')            // CSS selectors
$('[data-id="123"]')          // By attribute

// Getting content
elem.text()                   // Text content (strips HTML)
elem.html()                   // HTML content
elem.attr('href')             // Attribute value
elem.data('id')               // Data attribute

// Iterating
$('.item').toArray().map(item => {
    const $item = $(item);
    return $item.text();
});

// Modifying
$('.ads').remove()            // Remove elements
$('img').attr('src', newSrc)  // Change attributes
```

### Method 3: Puppeteer (LAST RESORT ⚠️)

**Use when:** Site heavily relies on JavaScript, has anti-bot protection, or requires login

**Disadvantages:** Slow, resource-intensive, complex

**Set `requirePuppeteer: true` in route features!**

```typescript
import { Route } from '@/types';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';
import puppeteer from '@/utils/puppeteer';
import { config } from '@/config';

export const route: Route = {
    path: '/user/:id',
    name: 'User Timeline',
    maintainers: ['yourname'],
    features: {
        requirePuppeteer: true,  // IMPORTANT: Declare Puppeteer requirement
        antiCrawler: true,       // Usually true for Puppeteer routes
    },
    handler,
};

async function handler(ctx) {
    const id = ctx.req.param('id');
    const url = `https://example.com/user/${id}`;

    // Get browser instance
    const browser = await puppeteer();

    try {
        const page = await browser.newPage();

        // Optional: Set headers and cookies
        await page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0...',
            'Cookie': 'session=xyz',
        });

        // Optional: Block unnecessary resources (speeds up loading)
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const type = request.resourceType();
            if (type === 'document' || type === 'script' || type === 'xhr') {
                request.continue();
            } else {
                request.abort();  // Block images, fonts, etc.
            }
        });

        // Navigate to page
        await page.goto(url, {
            waitUntil: 'domcontentloaded',  // or 'networkidle0'
        });

        // Wait for specific element
        await page.waitForSelector('.timeline-item');

        // Option A: Extract data using page.evaluate()
        const data = await page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.timeline-item').forEach(elem => {
                items.push({
                    title: elem.querySelector('.title').textContent,
                    link: elem.querySelector('a').href,
                    date: elem.querySelector('.date').textContent,
                });
            });
            return items;
        });

        // Option B: Get HTML and parse with Cheerio
        const html = await page.content();
        const $ = load(html);
        const data = $('.timeline-item').toArray().map(item => ({
            title: $(item).find('.title').text(),
            link: $(item).find('a').attr('href'),
        }));

        // Option C: Intercept API calls
        let apiData;
        page.on('response', async (response) => {
            if (response.url().includes('/api/timeline')) {
                apiData = await response.json();
            }
        });
        await page.waitForResponse(r => r.url().includes('/api/timeline'));

        return {
            title: `User ${id} Timeline`,
            link: url,
            item: data.map(item => ({
                title: item.title,
                link: item.link,
                pubDate: parseDate(item.date),
            })),
        };

    } finally {
        // IMPORTANT: Always close browser!
        await browser.close();
    }
}
```

**Advanced Puppeteer Pattern with Caching:**
```typescript
import { getPuppeteerPage } from '@/utils/puppeteer';

const data = await cache.tryGet(url, async () => {
    const { page, destory } = await getPuppeteerPage(url, {
        onBeforeLoad: async (page) => {
            // Setup before navigation
            await page.setRequestInterception(true);
            page.on('request', request => {
                request.resourceType() === 'image'
                    ? request.abort()
                    : request.continue();
            });
        },
    });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#content');

        const data = await page.evaluate(() => {
            return { /* extract data */ };
        });

        return data;
    } finally {
        await destory();  // Clean up page
    }
}, config.cache.routeExpire, false);
```

## 🛠️ Additional Utilities & Best Practices

### Key Utilities Reference

**ofetch** - Modern HTTP client (recommended for new routes)
```typescript
import ofetch from '@/utils/ofetch';
const data = await ofetch('https://api.example.com', { query: { limit: 10 } });
```

**got** - Backward-compatible HTTP client
```typescript
import got from '@/utils/got';
const { data } = await got('https://api.example.com');
```

**cache** - Caching with Redis or in-memory
```typescript
import cache from '@/utils/cache';
const item = await cache.tryGet(key, async () => fetchData());
```

**parseDate** - Intelligent date parsing
```typescript
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

parseDate('2024-01-01')              // Auto-detect format
parseDate('1609459200', 'X')        // Unix timestamp (seconds)
parseDate('1609459200000', 'x')     // Unix timestamp (milliseconds)
timezone(parseDate('2024-01-01 12:00:00'), +8)  // Apply timezone offset
```

**art-template** - Server-side templating
```typescript
import { art } from '@/utils/render';
import { getCurrentPath } from '@/utils/helpers';
const __dirname = getCurrentPath(import.meta.url);

const html = art(path.join(__dirname, 'templates/article.art'), {
    title: 'Article Title',
    content: 'Article content...',
});
```

**sanitize-html** - HTML sanitization (usually automatic)
```typescript
import sanitizeHtml from 'sanitize-html';
const clean = sanitizeHtml(dirtyHtml, {
    allowedTags: ['p', 'br', 'strong', 'em'],
    allowedAttributes: { 'a': ['href'] },
});
```

### Path Aliases

TypeScript paths configured in `tsconfig.json`:
```
@/* → lib/*
```

**Always use `@/` imports** instead of relative paths:
```typescript
// ✅ Good
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';

// ❌ Bad
import cache from '../../utils/cache';
```

### Handling URLs

**Relative to Absolute URLs:**
```typescript
import { load } from 'cheerio';

const baseUrl = 'https://example.com';
const $ = load(html);

// Method 1: Using new URL()
const link = new URL($('a').attr('href'), baseUrl).href;

// Method 2: For Cheerio elements
$('a').each((_, elem) => {
    const href = $(elem).attr('href');
    $(elem).attr('href', new URL(href, baseUrl).href);
});
```

### Error Handling Best Practices

```typescript
import NotFoundError from '@/errors/types/not-found';
import InvalidParameterError from '@/errors/types/invalid-parameter';
import CaptchaError from '@/errors/types/captcha';

async function handler(ctx) {
    const id = ctx.req.param('id');

    // Validate parameters
    if (!id || !/^\d+$/.test(id)) {
        throw new InvalidParameterError('Invalid ID format');
    }

    // Fetch data
    const { data } = await got(`https://api.example.com/item/${id}`);

    // Handle not found
    if (!data || data.length === 0) {
        throw new NotFoundError('Item not found');
    }

    // Handle captcha/rate limiting
    if (data.error === 'captcha_required') {
        throw new CaptchaError('Captcha verification required');
    }

    return { /* ... */ };
}
```

### Testing Your Route

**1. Local Testing:**
```bash
# Start dev server
pnpm dev

# Visit your route in browser
# http://localhost:1200/<namespace>/<your-route-path>

# Example: http://localhost:1200/github/issue/DIYgod/RSSHub/open
```

**2. Test with Query Parameters:**
```bash
# Test limit parameter
http://localhost:1200/github/issue/DIYgod/RSSHub?limit=5

# Test format parameter
http://localhost:1200/github/issue/DIYgod/RSSHub?format=json

# Test debug mode
http://localhost:1200/github/issue/DIYgod/RSSHub?debug=1
```

**3. Check Response Quality:**
- ✅ All items have `title`, `link`, `pubDate`
- ✅ Dates are properly parsed (not strings)
- ✅ HTML content is properly formatted
- ✅ Images load correctly
- ✅ No broken links
- ✅ Proper character encoding (UTF-8)

**4. Run Full Routes Test:**
```bash
# Test all route examples (including yours)
pnpm vitest:fullroutes
```

### Data Format Reference

**Feed-Level Data (returned from handler):**
```typescript
return {
    // Required
    title: string,              // Feed title
    link: string,               // Feed source URL

    // Strongly Recommended
    item: DataItem[],           // Array of feed items
    description: string,        // Feed description

    // Optional
    image: string,              // Feed image URL
    icon: string,               // Feed icon URL (favicon)
    logo: string,               // Feed logo URL
    author: string,             // Feed author
    language: string,           // ISO language code (e.g., 'en', 'zh-CN')
    ttl: number,                // Cache TTL in seconds
    allowEmpty: boolean,        // Allow empty feed (default: false)
    lastBuildDate: string,      // Last build date
    atomlink: string,           // Atom feed link
    id: string,                 // Feed ID

    // Podcast-specific
    itunes_author: string,
    itunes_category: string,
    itunes_explicit: boolean | string,
};
```

**Item-Level Data (DataItem):**
```typescript
{
    // Required
    title: string,              // Item title

    // Strongly Recommended
    link: string,               // Item URL
    description: string,        // Item content (HTML)
    pubDate: Date | string | number,  // Publication date

    // Recommended
    author: string | Array<{    // Author(s)
        name: string,
        url?: string,
        avatar?: string,
    }>,
    category: string[],         // Tags/categories
    guid: string,               // Unique identifier

    // Optional
    content: {                  // Alternative to description
        html: string,
        text: string,
    },
    image: string,              // Item image/thumbnail
    banner: string,             // Banner image
    updated: Date | string | number,  // Last update time
    doi: string,                // Digital Object Identifier
    language: string,           // Item language

    // Enclosures (for media)
    enclosure_url: string,
    enclosure_type: string,     // MIME type
    enclosure_title: string,
    enclosure_length: number,   // Size in bytes

    // Podcast-specific
    itunes_duration: number | string,
    itunes_item_image: string,

    // Advanced
    media: Record<string, Record<string, string>>,
    attachments: Array<{
        url: string,
        mime_type: string,
        title?: string,
        size_in_bytes?: number,
        duration_in_seconds?: number,
    }>,

    _extra: {                   // Custom metadata
        links?: Array<{
            url: string,
            type: string,
            content_html?: string,
        }>,
    },
}
```

## 📋 Development Guidelines & Best Practices

### Route Creation Checklist

**Before Starting:**
- [ ] Check if the site already has an RSS feed
- [ ] Search existing routes for similar patterns (`lib/routes/`)
- [ ] Verify the site allows scraping (check `robots.txt`)
- [ ] Test the site's API/HTML structure manually

**During Development:**
- [ ] Create namespace file (`namespace.ts`)
- [ ] Create route file with complete metadata
- [ ] Choose appropriate data fetching method (API > HTML > Puppeteer)
- [ ] Use `cache.tryGet()` for all detail page fetches
- [ ] Handle timezones with `timezone()` utility
- [ ] Support `limit` query parameter
- [ ] Test with `pnpm dev`

**Before Committing:**
- [ ] Run `pnpm format` to format code
- [ ] Ensure `example` field works correctly
- [ ] Test edge cases (empty results, errors, etc.)
- [ ] Check for proper error handling
- [ ] Verify all links are absolute URLs
- [ ] Remove any API keys or sensitive data

### Key Principles

1. **Prioritize User Privacy & Performance**
   - Use caching aggressively
   - Minimize external requests
   - Don't expose user data

2. **API > HTML > Puppeteer**
   - Always prefer official APIs when available
   - Use HTML parsing for simple sites
   - Only use Puppeteer when absolutely necessary

3. **Cache Everything**
   ```typescript
   // ✅ Good: Cache detail page fetches
   await Promise.all(
       items.map(item =>
           cache.tryGet(item.link, async () => {
               // Expensive operation here
           })
       )
   );

   // ❌ Bad: No caching
   await Promise.all(
       items.map(item => got(item.link))
   );
   ```

4. **Handle Timezones Correctly**
   ```typescript
   // ✅ Good: Specify timezone for local time
   timezone(parseDate('2024-01-01 12:00:00'), +8)

   // ✅ Good: ISO 8601 with timezone is auto-handled
   parseDate('2024-01-01T12:00:00+08:00')

   // ❌ Bad: Ambiguous local time without timezone
   parseDate('2024-01-01 12:00:00')  // Which timezone?
   ```

5. **Support Standard Query Parameters**
   ```typescript
   // Always support limit parameter
   const limit = ctx.req.query('limit')
       ? Math.min(Number.parseInt(ctx.req.query('limit'), 10), 100)
       : 20;  // Default to 20-50 items
   ```

6. **Use Descriptive Names**
   ```typescript
   // ✅ Good
   path: '/user/:username/posts'
   name: 'User Posts'

   // ❌ Bad
   path: '/u/:id/p'
   name: 'Posts'
   ```

### Route Design Principles (From Real-World Experience)

These principles are distilled from actual route optimization work, focusing on simplicity and maintainability.

#### 1. **KISS Principle: Simplicity is Beauty**

**The Problem:** Over-engineering is easy when you want to make routes "flexible" and "future-proof."

```typescript
// ❌ Bad: Over-engineered for "flexibility"
path: '/:language?/*'          // Supporting sub-paths "just in case"
parseRSSLinks()               // Multiple parsing modes
parseHTMLLinks()
getSubPath()                  // Complex path handling
configSystem                  // Flexible configuration

// ✅ Good: Only what's needed
path: '/:language?'           // Simple and clear
parseHTMLLinks()             // Single parsing method
```

**Core Insights:**
- **Deleting code is more important than adding code** (26% code reduction can improve maintainability)
- Three simple if-else statements > "flexible configuration system"
- When users ask for "simplicity," they mean it literally

#### 2. **Understand Requirements First, Code Second**

**Common Mistakes:**
1. See a website → Assume it needs RSS support
2. See multiple languages → Assume it needs sub-path support
3. See article details → Assume it needs multiple parsing modes

**Actual User Needs:**
- "I need full text" → Only HTML parsing needed
- "Three language versions" → No sub-paths needed
- "Default to Chinese" → Just set a default value

**Lessons:**
- 🚫 Don't assume users need "flexibility"
- ✅ Focus on core scenarios: 90% of users only use default settings
- ✅ Implement MVP (Minimum Viable Product) first, extend later if needed

#### 3. **Hono's Path Handling is Simple - Don't Overcomplicate It**

**The Detour:**
```typescript
// ❌ Bad: Overthinking path handling
path: '/:language?/*'
const subPath = getSubPath(ctx)  // Custom path parsing
const routePrefix = languages[language].routePrefix
```

**The Solution:**
```typescript
// ✅ Good: Use what Hono provides
path: '/:language?'
const language = ctx.req.param('language') || 'chinese'
```

**RSSHub Route Path Design Experience:**
- `/:param?` means optional parameter; handle defaults in the handler
- Don't use `/*` wildcard unless you truly need to match arbitrary sub-paths
- `ctx.req.param()` + `ctx.req.query()` covers 99% of use cases
- Simpler paths = easier documentation = better user experience

#### 4. **Real Verification > Theoretical Analysis**

**Key Turning Point:**
- Me: *Long analysis of RSS vs HTML parsing*
- User: "Are you sure they all have RSS?"
- Me: *Actually checks the website* → Found RSS, but user wants full text

**Lessons:**
- ✅ Open the browser and actually examine the site structure
- ✅ Test with `curl` to see actual response data
- ✅ Don't just read code - see real results
- ✅ When user says "verify it," test with real data

#### 5. **Lines of Code Aren't the Metric - Maintainability Is**

**Comparison:**

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Lines of Code | ~217 | ~160 | -26% |
| Supported Modes | RSS + HTML | HTML | -50% |
| Path Parameters | Complex | Simple | ✅ |
| Readable by newcomers? | ❌ | ✅ | 🎉 |

**Real Metrics:**
- ✅ Can you understand it 6 months later?
- ✅ Can a new maintainer understand it in 10 minutes?
- ✅ When bugs occur, can you locate them quickly?
- ✅ When changes are needed, is the scope small?

#### 6. **RSSHub Route Best Practices Checklist**

A design checklist extracted from optimization experience:

```typescript
// ✅ Good Route Design
export const route: Route = {
    path: '/:param?',              // Simple path
    parameters: {                  // Clear parameter documentation
        param: {
            default: 'something',  // Explicit default
            options: [...]         // Finite options (not infinite possibilities)
        }
    },
    example: '/site/param',        // Working example
}

async function handler(ctx) {
    // 1. Parameter validation (fail fast)
    const param = ctx.req.param('param') || 'default';
    if (!isValid(param)) {
        throw new InvalidParameterError('...');
    }

    // 2. Fetch list page (single request)
    const { data } = await got(listUrl);
    const $ = load(data);
    let items = parseLinks($);  // Extracted function, testable

    // 3. Fetch detail pages (batch concurrent + cache)
    items = await Promise.all(
        items.slice(0, limit).map(item =>
            cache.tryGet(item.link, async () => {
                // Detail fetch logic
            })
        )
    );

    // 4. Return standard format
    return { title, link, item };
}
```

**Pitfalls to Avoid:**
- ❌ Don't design "super flexible" parameter systems
- ❌ Don't support 10 different data sources
- ❌ Don't put complex business logic in routes
- ❌ Don't assume users need every possible configuration option

#### 7. **Listen to User Feedback, Especially "This Feels Too Complex"**

Three key pieces of user feedback:

1. **"I think the parameter should just be language"**
   → I misunderstood the requirement

2. **"You're making a simple problem complicated again"**
   → I over-engineered it

3. **"I want to keep this route simple"**
   → This is the core requirement

**Lesson:** When users say "too complex," they're right 99% of the time.

#### Summary: Design Principles

1. **Default scenario first**: 90% of users only use default settings - don't design complex systems for the 10% edge cases
2. **Fewer path parameters is better**: One `/:category?` is more maintainable than `/:type/:category?/:subcategory?`
3. **Delete unnecessary features**: Supporting 3 modes poorly < doing 1 mode excellently
4. **Real verification beats theoretical analysis**: Open the browser, test with curl
5. **Lines of code aren't the metric**: 50 fewer lines but clearer > 50 more lines of "flexibility"

### Route Categories

Must be one of these values (see `lib/types.ts`):
- `popular`, `social-media`, `new-media`, `traditional-media`
- `bbs`, `blog`, `programming`, `design`, `live`
- `multimedia`, `picture`, `anime`, `program-update`
- `university`, `forecast`, `travel`, `shopping`, `game`
- `reading`, `government`, `study`, `journal`, `finance`, `other`

### Configuration

Configuration is loaded from environment variables (see `lib/config.ts`). Common settings:

- `PORT`: Server port (default: 1200)
- `CACHE_TYPE`: `redis` or `memory` (default: memory)
- `REDIS_URL`: Redis connection string
- `PROXY_URI`: Global proxy for requests
- `ACCESS_KEY`: API access key for authentication
- `PUPPETEER_WS_ENDPOINT`: Remote browser endpoint

### Testing Strategy

- **Unit tests**: Place in same directory as source with `.test.ts` extension
- **Route tests**: Routes are automatically tested if `example` field is provided
- Coverage excludes `lib/routes/**` - routes are tested via full route tests
- Use `vitest` for all tests
- Mock external requests using `msw` (Mock Service Worker)

### Error Handling

- Routes should throw errors for invalid parameters or failed requests
- Errors are caught by `errorHandler` in `lib/errors`
- Sentry integration automatically logs errors in production

### Performance Considerations

1. **Prefer HTTP over Puppeteer** - Only use browser automation when absolutely necessary
2. **Use cache.tryGet() for details** - Batch requests with `Promise.all()`
3. **Set appropriate cache TTL** - Default is `config.cache.routeExpire` (300s)
4. **Limit item counts** - Default to 20-50 items, support `limit` query parameter
5. **Avoid recursive scraping** - Only fetch one level of detail

## 🔧 Route Maintenance & Debugging Best Practices

This section contains practical debugging techniques and maintenance guidelines derived from real-world route fixes.

### Pre-Flight Checks: Diagnosing Route Issues

When a route fails or needs updating, follow this standard diagnostic workflow:

#### 1. **Test Basic Connectivity**

```bash
# Check if the site is accessible
curl -I "https://example.com"

# Look for common issues
curl -v "https://example.com" 2>&1 | grep -E "HTTP|SSL|timeout|Host"
```

**Common problems:**
- `SSL certificate problem: self signed certificate` → Try with `-k` flag
- `timeout` → Site may be down or blocking requests
- `301/302` → Site has moved, update URL

#### 2. **Verify API Endpoints**

```bash
# Test JSON API
curl -s "https://api.example.com/news.json" | head -50

# If API returns 404, check if it moved
curl -s "https://example.com" | grep -o 'api/[^"]*'
```

**Key insight from nhk route:**
- API endpoints can disappear without notice (404)
- Always have HTML scraping as fallback plan

#### 3. **Test HTML Structure**

```bash
# Check if selectors still exist
curl -s "https://example.com" | grep -o 'class="[^"]*"' | sort -u

# Find article/item containers
curl -s "https://example.com" | grep -E '<article|class=".*list|class=".*item'

# Check for compression issues
curl -s "https://example.com" | head -50
# If you see binary data (����), add User-Agent:
curl -s -A "Mozilla/5.0" "https://example.com" | head -50
```

**Real example from nhandan route:**
- Without User-Agent: Binary gzip data
- With User-Agent: Normal HTML

#### 4. **Verify Selectors Match New Structure**

```bash
# Count matches for old selector
curl -s "https://example.com" | grep -o '<div class="old-selector">' | wc -l

# Find new selector candidates
curl -s "https://example.com" | grep -E 'article|timeline|content-list' | head -10
```

### Type Safety Checklist

**Every route must have an ArticleItem interface:**

```typescript
// ✅ Required at top of file
interface ArticleItem {
    title: string;
    link: string;
    pubDate?: Date;           // Optional: some sites don't have dates
    description?: string;     // Optional: filled in detail fetch
    author?: string;          // Optional
    category?: string[];      // Optional
    // Add other fields as needed
}

// ✅ Use the interface
let items: ArticleItem[] = $('.selector')
    .toArray()
    .map((element) => {
        const $item = $(element);
        return {
            title: $item.find('.title').text(),
            link: $item.find('a').attr('href') || '',
        };
    });
```

**Why this matters:**
- Prevents `any` type propagation
- Provides IDE autocomplete
- Makes code self-documenting
- Catches type errors at compile time

### Null Safety Patterns

**Cheerio methods can return null/undefined - always guard:**

```typescript
// ❌ Dangerous: .html() returns null if not found
item.description += $('.article-body').html();

// ✅ Safe: provide fallback
item.description += $('.article-body').html() || '';

// ❌ Dangerous: .attr() returns undefined
const link = $item.find('a').attr('href');

// ✅ Safe: provide fallback and type guard
const href = $item.find('a').attr('href');
const link = href ? `${rootUrl}${href}` : '';

// Or use optional chaining with nullish coalescing
const link = $item.find('a').attr('href') ?? '';
```

**Common pitfall locations:**
- `.html()` - returns `null` if selector not found
- `.attr()` - returns `undefined` if attribute doesn't exist
- `.text()` - returns empty string (safe)
- `.prop()` - returns `undefined` if property doesn't exist

### Timezone Handling Rules

**The timezone parameter specifies the SOURCE timezone, not target:**

```typescript
// ✅ Correct: Scraped time is in Korea (UTC+9)
const pubDate = timezone(parseDate('2025-01-15 14:30'), +9);
// RSS readers will auto-convert to user's local timezone

// ✅ Correct: Unix timestamp is already UTC
const pubDate = parseDate(item.updated_at, 'x');
// No timezone() needed - 'x' format means Unix milliseconds (UTC)

// ✅ Correct: ISO 8601 with timezone
const pubDate = parseDate('2025-01-15T14:30:00+09:00');
// Already has timezone info, parseDate handles it

// ❌ Wrong: Don't convert to your local timezone
const pubDate = timezone(parseDate(koreanTime), +8);  // Wrong! Source is +9
```

**Timezone reference:**
- Japan/Korea: `+9`
- China/Taiwan/Hong Kong: `+8`
- Vietnam/Thailand: `+7`
- UTC: `+0`

**From official docs:** `timezone(parseDate(date), offset)` - the offset parameter indicates what timezone the scraped time is IN, not what timezone to convert TO.

### Variable Naming Conventions

**Follow these patterns for consistency:**

```typescript
// ✅ Cheerio objects: prefix with $
const $ = load(response);           // Main Cheerio instance
const $detail = load(detailHTML);   // Detail page Cheerio instance
const $item = $(element);           // Wrapped element

// ✅ DOM elements: use descriptive names
.toArray()
.map((element) => {                 // Raw DOM element
    const $item = $(element);       // Wrapped Cheerio object
    return { ... };
});

// ❌ Bad: Reassigning parameter
.map((item) => {
    item = $(item);                 // Confusing: changes type
    return { ... };
});

// ✅ Use .toArray() instead of .get()
$('.selector').toArray()            // Returns Element[]
$('.selector').get()                // Deprecated, use .toArray()

// ✅ When getting attributes
.map((element) => {
    const $element = $(element);
    return $(element).attr('href');
})
// Or with Cheerio helper
.toArray()
.map((e) => $(e).attr('content'))
```

### got vs ofetch: Important Note

**Hidden implementation detail:**

```typescript
// What you write:
import got from '@/utils/got';
const { data } = await got(url);

// What actually runs:
// lib/utils/got.ts internally uses ofetch
import ofetch from '@/utils/ofetch';

// This means:
// - Error stacks will show "ofetch" not "got"
// - Both are functionally equivalent
// - Don't be confused by error messages mentioning ofetch
```

### Common Website Changes Patterns

Based on real fixes, websites typically change in these ways:

| Change Type | Example | How to Detect | Fix Strategy |
|------------|---------|---------------|--------------|
| **Class Rename** | `.rank-1` → `.abf-cate` | Old selector returns 0 items | Search for semantic class names |
| **Structure Change** | `.list-block` → `.table-row` | Empty feed or errors | Inspect current HTML structure |
| **Tag Change** | `h3 a` → `h2 a, h4 a` | Some items missing | Support both old and new tags |
| **API Removal** | JSON endpoint → 404 | FetchError 404 | Switch to HTML scraping |
| **URL Change** | `/news/easy/` → 404 | Site not found | Search for new URL structure |

**Debugging command:**

```bash
# Find what changed
curl -s "https://example.com" | \
  grep -oE 'class="[^"]*"' | \
  grep -E "list|item|article|content" | \
  sort | uniq -c
```

### Route Maintenance Workflow

When updating an existing route:

```bash
# 1. Understand current state
git diff lib/routes/site/route.ts

# 2. Test current behavior
curl "http://localhost:1200/site/route?limit=1"

# 3. Diagnose the issue
curl -s "https://actualsite.com" | grep "old-selector"  # Returns 0?
curl -s "https://actualsite.com" | grep "new-selector"  # Find this

# 4. Make changes (tsx will auto-reload)
# Edit file...

# 5. Test immediately (no restart needed)
curl "http://localhost:1200/site/route?limit=1" | grep "<title>"

# 6. Verify key fields
curl -s "http://localhost:1200/site/route?limit=2" | \
  grep -E "<title>|<pubDate>|<link>" | head -10
```

**Key insight:** With `tsx watch`, you don't need to restart the server. Just edit and test.

### When to Delete vs Fix

**Delete the route if:**
- ✅ API is permanently gone (404) and no HTML alternative exists
- ✅ Website is completely offline
- ✅ Another route provides the same functionality better
- ✅ Maintenance cost > user value

**Fix the route if:**
- ✅ Just needs selector updates (website redesign)
- ✅ API changed but new one exists
- ✅ Adding User-Agent header solves it
- ✅ Has active users/maintainers

**User wisdom:** "Just delete it - I only need one working scraping solution."

Don't over-engineer fixes for deprecated routes. Keep the codebase clean.

### Quick Debug Commands Reference

```bash
# Test connectivity
curl -I "https://site.com"

# Check SSL issues
curl -v "https://site.com" 2>&1 | grep SSL

# Test with User-Agent (fixes many issues)
curl -s -A "Mozilla/5.0" "https://site.com"

# Find article selectors
curl -s "https://site.com" | grep -E 'class=".*"' | grep -i article

# Count selector matches
curl -s "https://site.com" | grep -o 'class="target"' | wc -l

# Test JSON API
curl -s "https://api.site.com/endpoint" | jq '.' | head -30

# Check for redirects
curl -L -s -o /dev/null -w "%{http_code} %{url_effective}\n" "https://site.com"

# Test route locally
curl -s "http://localhost:1200/route?limit=1" | head -50

# Check route metadata
curl -s "http://localhost:1200/route?limit=1" | grep -E "<title>|<link>|<pubDate>"
```

### Checklist for Route Review

When reviewing or fixing routes:

- [ ] **Type Safety**: Has `ArticleItem` interface defined?
- [ ] **Null Safety**: All `.html()` and `.attr()` calls have fallbacks?
- [ ] **Timezone**: Uses `timezone()` correctly with source timezone?
- [ ] **Variable Naming**: Cheerio objects use `$` prefix?
- [ ] **Error Handling**: Gracefully handles missing elements?
- [ ] **Caching**: Uses `cache.tryGet()` for detail pages?
- [ ] **Testing**: Actually tested with `curl` against live site?
- [ ] **Documentation**: `example` field works correctly?

### Real-World Example: nhandan Route Fix

**Problem:** Empty feed after website redesign

**Diagnosis:**
```bash
# 1. Test the site
curl -s "https://cn.nhandan.vn/political/" | head -20
# Output: Binary gzip data ����...

# 2. Add User-Agent
curl -s -A "Mozilla/5.0" "https://cn.nhandan.vn/political/" | grep article
# Output: HTML, but old selectors gone

# 3. Find new selectors
curl -s -A "Mozilla/5.0" "https://cn.nhandan.vn/political/" | \
  grep -o 'class="[^"]*"' | grep -E "article|list"
# Output: class="abf-cate", class="timeline content-list"
```

**Fix applied:**
1. Added User-Agent headers to `got` calls
2. Updated selectors: `.rank-1` → `.abf-cate article`
3. Updated selectors: `.box-content.content-list` → `.timeline.content-list`
4. Added timezone support: `timezone(parseDate(datetime), +7)`
5. Added null safety: `.html() || ''`

**Result:** Route working again with 3 articles in feed.

## Build System

- **tsdown**: Used for TypeScript compilation (configured in `tsdown.config.ts`)
- **Build scripts**: `scripts/workflow/build-routes.ts` generates route metadata
- **Assets**: Build outputs go to `assets/build/` (maintainers, radar, routes)
- **Vercel build**: Special build process for serverless deployment

## Middleware Notes

Middleware runs in order (see `lib/app-bootstrap.tsx`):
1. **logger**: Request/response logging
2. **trace**: OpenTelemetry tracing
3. **sentry**: Error tracking
4. **accessControl**: IP/key-based access control
5. **debug**: Debug mode handler
6. **template**: Query parameter processing (format, filter, limit, etc.)
7. **header**: Response headers (CORS, cache-control)
8. **antiHotlink**: Image proxy for blocked hotlinks
9. **parameter**: Parameter validation
10. **cache**: Response caching

## ESLint & Prettier

- Configuration: `eslint.config.mjs`
- Auto-fix on commit via husky pre-commit hook
- Runs on: `*.ts`, `*.tsx`, `*.js`, `*.yml`
- Extends: `recommended`, `plugin:@typescript-eslint/recommended`, `plugin:unicorn/recommended`

## 🎯 Common Patterns & Solutions

### Using Configuration Values

```typescript
import { config } from '@/config';

async function handler(ctx) {
    // Access namespace-specific config
    const apiKey = config.github?.access_token;

    if (!apiKey) {
        throw new ConfigNotFoundError('GitHub API token is required');
    }

    // Use in requests
    const { data } = await got('https://api.github.com/user/repos', {
        headers: {
            authorization: `token ${apiKey}`,
        },
    });

    return { /* ... */ };
}

// Declare config requirement
export const route: Route = {
    // ...
    features: {
        requireConfig: [
            {
                name: 'GITHUB_ACCESS_TOKEN',
                description: 'GitHub personal access token',
            },
        ],
    },
};
```

### Handling Pagination

```typescript
async function handler(ctx) {
    const limit = ctx.req.query('limit')
        ? Math.min(Number.parseInt(ctx.req.query('limit'), 10), 100)
        : 20;

    let allItems = [];
    let page = 1;
    const perPage = 20;

    // Fetch multiple pages until we have enough items
    while (allItems.length < limit) {
        const { data } = await got({
            url: 'https://api.example.com/items',
            searchParams: {
                page,
                per_page: perPage,
            },
        });

        if (data.length === 0) break;  // No more items

        allItems = allItems.concat(data);
        page++;

        if (data.length < perPage) break;  // Last page
    }

    return {
        title: 'Paginated Feed',
        item: allItems.slice(0, limit).map(/* ... */),
    };
}
```

### Handling Authentication Cookies

```typescript
import { CookieJar } from 'tough-cookie';

async function handler(ctx) {
    const cookieJar = new CookieJar();

    // Method 1: Login and get cookies
    await got.post('https://example.com/login', {
        json: { username: 'user', password: 'pass' },
        cookieJar,
    });

    // Method 2: Use existing cookies
    await cookieJar.setCookie('session=xyz123', 'https://example.com');

    // Use cookies in subsequent requests
    const { data } = await got('https://example.com/protected', {
        cookieJar,
    });

    return { /* ... */ };
}
```

### Working with GraphQL APIs

```typescript
async function handler(ctx) {
    const query = `
        query GetUserPosts($username: String!, $limit: Int!) {
            user(login: $username) {
                posts(first: $limit) {
                    nodes {
                        title
                        url
                        createdAt
                        content
                    }
                }
            }
        }
    `;

    const { data } = await got({
        method: 'post',
        url: 'https://api.example.com/graphql',
        json: {
            query,
            variables: {
                username: ctx.req.param('username'),
                limit: 20,
            },
        },
        headers: {
            authorization: `Bearer ${apiKey}`,
        },
    });

    return {
        title: `Posts by ${ctx.req.param('username')}`,
        item: data.data.user.posts.nodes.map(post => ({
            title: post.title,
            link: post.url,
            pubDate: parseDate(post.createdAt),
            description: post.content,
        })),
    };
}
```

### Handling Rate Limits

```typescript
import { config } from '@/config';

async function handler(ctx) {
    try {
        const { data } = await got('https://api.example.com/data');
        return { /* ... */ };
    } catch (error) {
        if (error.response?.statusCode === 429) {
            // Rate limited
            const retryAfter = error.response.headers['retry-after'];
            throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
        }
        throw error;
    }
}

// Alternative: Use cache to avoid hitting rate limits
const data = await cache.tryGet(
    cacheKey,
    async () => {
        const { data } = await got('https://api.example.com/data');
        return data;
    },
    config.cache.routeExpire * 2  // Longer cache for rate-limited APIs
);
```

### Working with Binary Data (Images, PDFs)

```typescript
async function handler(ctx) {
    // Fetch image as buffer
    const { data: imageBuffer } = await got({
        url: 'https://example.com/image.jpg',
        responseType: 'buffer',
    });

    // Convert to base64 for embedding
    const base64Image = imageBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Image}`;

    return {
        title: 'Image Feed',
        item: [{
            title: 'Image Item',
            description: `<img src="${dataUri}" />`,
        }],
    };
}
```

### Handling Different Date Formats

```typescript
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

// ISO 8601
parseDate('2024-01-01T12:00:00Z')
parseDate('2024-01-01T12:00:00+08:00')

// Unix timestamps
parseDate('1704110400', 'X')        // seconds
parseDate('1704110400000', 'x')     // milliseconds

// Custom formats (using dayjs)
parseDate('01/01/2024', 'MM/DD/YYYY')
parseDate('2024年1月1日', 'YYYY年M月D日')

// With timezone
timezone(parseDate('2024-01-01 12:00:00'), +8)     // CST (UTC+8)
timezone(parseDate('2024-01-01 12:00:00'), -5)     // EST (UTC-5)

// Relative dates
parseDate('2 hours ago')    // Not supported, use dayjs
import dayjs from 'dayjs';
dayjs().subtract(2, 'hours').toDate()
```

### Markdown to HTML Conversion

```typescript
import MarkdownIt from 'markdown-it';

const md = MarkdownIt({
    html: true,         // Enable HTML tags
    linkify: true,      // Auto-convert URLs to links
    breaks: true,       // Convert \n to <br>
});

async function handler(ctx) {
    const markdownContent = '# Hello\n\nThis is **bold**';
    const htmlContent = md.render(markdownContent);

    return {
        title: 'Markdown Feed',
        item: [{
            title: 'Article',
            description: htmlContent,
        }],
    };
}
```

## ⚠️ Common Pitfalls & How to Avoid Them

### 1. **Not Using Path Aliases**
```typescript
// ❌ Bad: Relative imports
import cache from '../../utils/cache';

// ✅ Good: Path alias
import cache from '@/utils/cache';
```

### 2. **Forgetting to Format Code**
```bash
# Always run before committing
pnpm format

# Or use the pre-commit hook (automatic)
git commit -m "message"
```

### 3. **Not Caching Detail Fetches**
```typescript
// ❌ Bad: No caching, will be slow
const items = await Promise.all(
    list.map(async item => {
        const { data } = await got(item.link);
        return { ...item, description: data };
    })
);

// ✅ Good: Cached fetches
const items = await Promise.all(
    list.map(item =>
        cache.tryGet(item.link, async () => {
            const { data } = await got(item.link);
            return { ...item, description: data };
        })
    )
);
```

### 4. **Hardcoding Item Limits**
```typescript
// ❌ Bad: Fixed limit
const items = data.slice(0, 10);

// ✅ Good: Configurable limit
const limit = ctx.req.query('limit')
    ? Math.min(Number.parseInt(ctx.req.query('limit'), 10), 100)
    : 20;
const items = data.slice(0, limit);
```

### 5. **Not Handling Timezones**
```typescript
// ❌ Bad: Ambiguous time
parseDate('2024-01-01 12:00:00')  // Which timezone?

// ✅ Good: Explicit timezone
timezone(parseDate('2024-01-01 12:00:00'), +8)  // Beijing Time

// ✅ Good: ISO 8601 with timezone
parseDate('2024-01-01T12:00:00+08:00')
```

### 6. **Creating Routes for Sites with RSS**
```bash
# Always check first!
curl -s https://example.com | grep -i "rss\|atom\|feed"
curl -s https://example.com/feed
curl -s https://example.com/rss.xml
```

### 7. **Not Declaring Puppeteer Requirement**
```typescript
// ❌ Bad: Using Puppeteer without declaration
import puppeteer from '@/utils/puppeteer';
export const route: Route = {
    features: {
        requirePuppeteer: false,  // WRONG!
    },
};

// ✅ Good: Properly declared
export const route: Route = {
    features: {
        requirePuppeteer: true,
        antiCrawler: true,
    },
};
```

### 8. **Not Closing Puppeteer Browser**
```typescript
// ❌ Bad: Memory leak
const browser = await puppeteer();
const page = await browser.newPage();
// ... do stuff
// Forgot to close!

// ✅ Good: Always close
const browser = await puppeteer();
try {
    const page = await browser.newPage();
    // ... do stuff
} finally {
    await browser.close();
}
```

### 9. **Exposing Sensitive Data**
```typescript
// ❌ Bad: API key in URL
const url = `https://api.example.com/data?key=${config.apiKey}`;

// ✅ Good: API key in header
const { data } = await got('https://api.example.com/data', {
    headers: {
        authorization: `Bearer ${config.apiKey}`,
    },
});

// Always remove sensitive data from commits
// Add to .gitignore: .env, config.local.ts, etc.
```

### 10. **Returning String Dates Instead of Date Objects**
```typescript
// ❌ Bad: String date
item: [{
    pubDate: '2024-01-01',  // Wrong type!
}]

// ✅ Good: Date object
item: [{
    pubDate: parseDate('2024-01-01'),  // Returns Date
}]
```

## 📚 Additional Resources

- **Official Documentation**: https://docs.rsshub.app/
- **Contributing Guide**: https://docs.rsshub.app/joinus/
- **Route Examples**: Browse `lib/routes/` directory
- **Type Definitions**: See `lib/types.ts` for complete data structures
- **Hono Documentation**: https://hono.dev/
- **Cheerio Documentation**: https://cheerio.js.org/

## 🔍 Quick Reference Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm dev:cache              # Start with production cache

# Testing
pnpm test                   # Run all tests + format check
pnpm vitest:watch           # Watch mode
pnpm vitest:fullroutes      # Test all route examples

# Code Quality
pnpm format                 # Format all code
pnpm format:check           # Check without fixing
pnpm lint                   # Run ESLint

# Building
pnpm build                  # Build for production
pnpm start                  # Run production build

# Access your route
http://localhost:1200/<namespace>/<path>
http://localhost:1200/<namespace>/<path>?limit=10
http://localhost:1200/<namespace>/<path>?format=json
http://localhost:1200/<namespace>/<path>?debug=1
```