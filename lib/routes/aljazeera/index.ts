import { Route, ViewType } from '@/types';
import { getCurrentPath } from '@/utils/helpers';
const __dirname = getCurrentPath(import.meta.url);

import cache from '@/utils/cache';
import { load, type CheerioAPI } from 'cheerio';
import { art } from '@/utils/render';
import path from 'node:path';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';
import InvalidParameterError from '@/errors/types/invalid-parameter';

interface ArticleItem {
    link: string;
    title?: string;
    author?: string;
    pubDate?: Date;
    description?: string;
}

const languages = {
    arabic: {
        rootUrl: 'https://www.aljazeera.net',
        timezone: 3, // Qatar UTC+3
    },
    chinese: {
        rootUrl: 'https://chinese.aljazeera.net',
        timezone: 8, // Default to CST
    },
    english: {
        rootUrl: 'https://www.aljazeera.com',
        timezone: 0, // UTC
    },
};

export const route: Route = {
    path: '/:language?',
    name: 'News',
    url: 'aljazeera.com',
    categories: ['traditional-media'],
    view: ViewType.Articles,
    example: '/aljazeera',
    parameters: {
        language: {
            description: 'Language edition',
            default: 'chinese',
            options: [
                { value: 'chinese', label: 'Chinese - 中文' },
                { value: 'english', label: 'English' },
                { value: 'arabic', label: 'Arabic - الجزيرة' },
            ],
        },
    },
    description: `
Al Jazeera news with full article content.

**Examples:**
- \`/aljazeera\` - Chinese edition (default)
- \`/aljazeera/english\` - English edition
- \`/aljazeera/arabic\` - Arabic edition

**Query Parameters:**
- \`limit\` - Number of articles (default: 50, max: 50)
`,
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['aljazeera.net/*', 'aljazeera.com/*', 'chinese.aljazeera.net/*'],
            target: '/:language',
        },
    ],
    maintainers: ['nczitzk'],
    handler,
};

// Extract article links from HTML page
function parseHTMLLinks($: CheerioAPI, rootUrl: string): ArticleItem[] {
    return $('.u-clickable-card__link')
        .toArray()
        .map((item) => {
            const href = $(item).attr('href');
            if (!href) {
                return null;
            }

            return {
                link: href.startsWith('http') ? href : `${rootUrl}${href}`,
            };
        })
        .filter((item): item is ArticleItem => item !== null);
}

async function handler(ctx) {
    // Get language from route parameter (default to chinese)
    const languageParam = ctx.req.param('language') || 'chinese';

    // Validate language
    if (!Object.hasOwn(languages, languageParam)) {
        throw new InvalidParameterError(`Unsupported language: ${languageParam}. Use: chinese, english, or arabic`);
    }

    const language = languageParam as keyof typeof languages;
    const rootUrl = languages[language].rootUrl;

    // Fetch homepage
    const { data: response } = await got(rootUrl);
    const $ = load(response);

    // Parse article links from homepage
    let items = parseHTMLLinks($, rootUrl);

    // Apply limit
    const limit = ctx.req.query('limit') ? Math.min(Number.parseInt(ctx.req.query('limit'), 10), 50) : 50;

    // Fetch article details with caching
    items = await Promise.all(
        items.slice(0, limit).map((item) =>
            cache.tryGet(item.link, async () => {
                const { data: detailResponse } = await got(item.link);
                const content = load(detailResponse);

                // Clean up unwanted elements
                content('.more-on').remove();
                content('.responsive-image img').removeAttr('srcset');

                // Extract date from multiple sources
                const datePublishedMatch = detailResponse.match(/"datePublished": ?"(.*?)"/);
                const uploadDateMatch = detailResponse.match(/"uploadDate": ?"(.*?)"/);
                const dateString = datePublishedMatch?.[1] || uploadDateMatch?.[1] || content('div.date-simple > span:nth-child(2)').text();

                // Parse date with timezone
                const pubDate = dateString ? timezone(parseDate(dateString), languages[language].timezone) : undefined;

                // Extract article content
                item.title = content('h1').first().text();
                item.author = content('.author').text();
                item.pubDate = pubDate;
                item.description = art(path.join(__dirname, 'templates/description.art'), {
                    image: content('.article-featured-image').html(),
                    description: content('div.wysiwyg').html(),
                });

                return item;
            })
        )
    );

    return {
        title: $('title').first().text(),
        link: rootUrl,
        item: items
            .filter((item): item is Required<ArticleItem> => Boolean(item.title))
            .map((item) => ({
                title: item.title,
                link: item.link,
                description: item.description || '',
                author: item.author,
                pubDate: item.pubDate,
            })),
        allowEmpty: true,
    };
}
