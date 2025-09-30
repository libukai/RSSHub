import { Route } from '@/types';
import cache from '@/utils/cache';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';
import { art } from '@/utils/render';
import path from 'node:path';
import { getCurrentPath } from '@/utils/helpers';
import got from '@/utils/got';

const __dirname = getCurrentPath(import.meta.url);

interface ArticleItem {
    title: string;
    link: string;
    pubDate: Date;
    author?: string;
    language?: string;
    description?: string;
    category?: string[];
    content?: {
        html: string;
        text: string;
    };
    image?: string;
    banner?: string;
}

async function handler(ctx) {
    const { category = '' } = ctx.req.param();
    const limit = ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit'), 10) : 20;

    const rootUrl = 'https://chinese.joins.com';
    const currentUrl = `${rootUrl}/news/articleList.html?view_type=sm${category ? `&sc_section_code=${category}` : ''}`;

    const { data: response } = await got(currentUrl);
    const $ = load(response);
    const language = $('html').prop('lang');

    let items: ArticleItem[] = $('section.article-list-content div.table-row')
        .slice(0, limit)
        .toArray()
        .map((element) => {
            const $item = $(element);
            const dateText = $item.find('div.list-dated').text().split(/\|/).pop();
            const href = $item.find('a').prop('href');
            return {
                title: $item.find('div.list-titles').text(),
                pubDate: timezone(parseDate(dateText || ''), +9),
                link: new URL(href || '', rootUrl).href,
                author: $item.find('div.list-dated').text().split(/\|/)[0],
                language,
            };
        });

    items = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link, async () => {
                const { data: detailResponse } = await got(item.link);
                const $$ = load(detailResponse);

                $$('a.articles').remove();
                $$('div.view-copyright, div.ad-template, div.view-editors, div.tag-group').remove();

                const title = $$('div.article-head-title, div.viewer-titles').text();
                const description = art(path.join(__dirname, 'templates/description.art'), {
                    images:
                        $$('div.photo-box').length === 0
                            ? undefined
                            : $$('div.photo-box')
                                  .toArray()
                                  .map((i) => {
                                      const image = $$(i).find('img');
                                      return image.prop('src')
                                          ? {
                                                src: image.prop('src'),
                                            }
                                          : undefined;
                                  }),
                    description: $$('div#article-view-content-div').html(),
                });
                const image = $$('meta[property="og:image"]').prop('content');

                item.title = title;
                item.description = description;
                // item.pubDate = parseDate($$('meta[property="article:published_time"]').prop('content'));
                item.category = $$('meta[name="keywords"]').prop('content')?.split(/,/) ?? $$('meta[name="news_keywords"]').prop('content')?.split(/,/) ?? [];
                item.author = $$('meta[property="og:article:author"]').prop('content');
                item.content = {
                    html: description,
                    text: $$('div#article-view-content-div').text(),
                };
                item.image = image;
                item.banner = image;
                item.language = language;

                return item;
            })
        )
    );

    const imageSrc = $('div.user-logo img').prop('src');
    const image = imageSrc ? new URL(imageSrc, rootUrl).href : undefined;

    return {
        title: `${$(`a[data-code="${category}"]`)?.text() || $('ul#user-menu a').first().text()} - ${$('title').text()}`,
        description: $('meta[property="og:description"]').prop('content'),
        link: currentUrl,
        item: items,
        allowEmpty: true,
        image,
        author: $('meta[property="og:site_name"]').prop('content'),
        language,
    };
}

export const route: Route = {
    path: '/chinese/:category?',
    categories: ['traditional-media'],
    example: '/chinese',
    parameters: { category: '分类，默认为空，可在对应分类页 URL 中找到 `sc_section_code`' },
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
            source: ['chinese.joins.com/news/articleList.html'],
            target: (url) => {
                const category = url.searchParams.get('sc_section_code');
                return `/joins/chinese${category ? `/${category}` : ''}`;
            },
        },
        {
            title: '财经',
            source: ['chinese.joins.com/news/articleList.html'],
            target: '/chinese/S1N1',
        },
        {
            title: '国际',
            source: ['chinese.joins.com/news/articleList.html'],
            target: '/chinese/S1N2',
        },
        {
            title: '北韩',
            source: ['chinese.joins.com/news/articleList.html'],
            target: '/chinese/S1N3',
        },
        {
            title: '政治·社会',
            source: ['chinese.joins.com/news/articleList.html'],
            target: '/chinese/S1N4',
        },
        {
            title: '中国观察',
            source: ['chinese.joins.com/news/articleList.html'],
            target: '/chinese/S1N5',
        },
        {
            title: '社论',
            source: ['chinese.joins.com/news/articleList.html'],
            target: '/chinese/S1N26',
        },
        {
            title: '专栏·观点',
            source: ['chinese.joins.com/news/articleList.html'],
            target: '/chinese/S1N11',
        },
        {
            title: '军事·科技',
            source: ['chinese.joins.com/news/articleList.html'],
            target: '/chinese/S1N6',
        },
        {
            title: '娱乐体育',
            source: ['chinese.joins.com/news/articleList.html'],
            target: '/chinese/S1N7',
        },
        {
            title: '教育',
            source: ['chinese.joins.com/news/articleList.html'],
            target: '/chinese/S1N8',
        },
        {
            title: '旅游美食',
            source: ['chinese.joins.com/news/articleList.html'],
            target: '/chinese/S1N9',
        },
        {
            title: '时尚',
            source: ['chinese.joins.com/news/articleList.html'],
            target: '/chinese/S1N10',
        },
        {
            title: '图集',
            source: ['chinese.joins.com/news/articleList.html'],
            target: '/chinese/S1N12',
        },
    ],
    name: '中央日报中文版',
    maintainers: ['nczitzk'],
    handler,
    url: 'chinese.joins.com',
    description: `:::tip
若订阅 [财经](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N1)，网址为 \`https://chinese.joins.com/news/articleList.html?sc_section_code=S1N1\`。截取 \`sc_section_code\` 的值作为参数填入，此时路由为 [\`/joins/chinese/S1N1\`](https://rsshub.app/joins/chinese/S1N1)。
:::

| 分类 | \`sc_section_code\` |
| ---- | ------------------ |
| [财经](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N1) | [S1N1](https://rsshub.app/joins/chinese/S1N1) |
| [国际](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N2) | [S1N2](https://rsshub.app/joins/chinese/S1N2) |
| [北韩](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N3) | [S1N3](https://rsshub.app/joins/chinese/S1N3) |
| [政治·社会](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N4) | [S1N4](https://rsshub.app/joins/chinese/S1N4) |
| [中国观察](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N5) | [S1N5](https://rsshub.app/joins/chinese/S1N5) |
| [社论](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N26) | [S1N26](https://rsshub.app/joins/chinese/S1N26) |
| [专栏·观点](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N11) | [S1N11](https://rsshub.app/joins/chinese/S1N11) |
| [军事·科技](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N6) | [S1N6](https://rsshub.app/joins/chinese/S1N6) |
| [娱乐体育](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N7) | [S1N7](https://rsshub.app/joins/chinese/S1N7) |
| [教育](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N8) | [S1N8](https://rsshub.app/joins/chinese/S1N8) |
| [旅游美食](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N9) | [S1N9](https://rsshub.app/joins/chinese/S1N9) |
| [时尚](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N10) | [S1N10](https://rsshub.app/joins/chinese/S1N10) |
| [图集](https://chinese.joins.com/news/articleList.html?sc_section_code=S1N12) | [S1N12](https://rsshub.app/joins/chinese/S1N12) |`,
};
