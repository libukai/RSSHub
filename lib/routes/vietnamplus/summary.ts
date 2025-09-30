import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

interface ArticleItem {
    title: string;
    link: string;
    pubDate?: Date;
    description?: string;
}

const types = {
    coffee: '早安咖啡',
    tea: '下午茶',
} as const;

export const route: Route = {
    path: '/summary/:type?',
    categories: ['traditional-media'],
    example: '/vietnamplus/summary/coffee',
    parameters: {
        type: '资讯类型，见下表，默认为 coffee',
    },
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
            source: ['zh.vietnamplus.vn/search'],
            target: '/vietnamplus/summary/:type',
        },
    ],
    name: '新闻汇总',
    maintainers: ['Libukai'],
    handler: async (ctx) => {
        const type = ctx.req.param('type') || 'coffee';
        const rootUrl = 'https://zh.vietnamplus.vn';
        const searchUrl = `${rootUrl}/search/?q=${types[type]}`;

        const { data: response } = await got(searchUrl);
        const $ = load(response);

        // 获取新闻列表
        const lists: ArticleItem[] = $('.timeline .story')
            .toArray()
            .map((element) => {
                const $item = $(element);
                const href = $item.find('h2 a').attr('href');
                const title = $item.find('h2 a').text();
                return {
                    title: title || '',
                    link: href ? String(href) : '',
                };
            });

        // 获取每篇文章的详细内容
        const items: ArticleItem[] = await Promise.all(
            lists.map((item) =>
                cache.tryGet(item.link, async () => {
                    const { data: response } = await got(item.link);
                    const $detail = load(response);

                    // 获取发布时间
                    const datetime = $detail('time').attr('datetime');
                    item.pubDate = datetime ? timezone(parseDate(datetime), +7) : undefined;

                    // 获取文章内容
                    item.description = $detail('.article__body').html() || '';

                    return item;
                })
            )
        );

        return {
            title: `越通社 | ${types[type]}`,
            link: rootUrl,
            item: items,
        };
    },
};
