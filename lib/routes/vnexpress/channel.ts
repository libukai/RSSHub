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

const channels = {
    news: '时政',
    business: '经济',
    travel: '旅游',
    life: '生活',
    sports: '体育',
    world: '国际',
    perspective: '观点',
} as const;

export const route: Route = {
    path: '/:channel?',
    categories: ['traditional-media'],
    example: '/vnexpress/news',
    parameters: {
        channel: '频道，见下表，默认为 news',
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
            source: ['e.vnexpress.net/news/:channel'],
            target: '/vnexpress/:channel',
        },
    ],
    name: 'VNExpress',
    maintainers: ['Libukai'],
    handler: async (ctx) => {
        const channel = ctx.req.param('channel') || 'news';
        const rootUrl = 'https://e.vnexpress.net/news';
        const channelUrl = `${rootUrl}/${channel}`;

        const { data: response } = await got(channelUrl);
        const $ = load(response);

        // 获取新闻列表
        const lists: ArticleItem[] = $('.title_news_site')
            .toArray()
            .map((element) => {
                const $item = $(element);
                const href = $item.find('h4 a').attr('href');
                const title = $item.find('h4 a').attr('title');
                return {
                    title: title ? String(title) : '',
                    link: href ? String(href) : '',
                };
            });

        // 获取每篇文章的详细内容
        const items: ArticleItem[] = await Promise.all(
            lists.map((item) =>
                cache.tryGet(item.link, async () => {
                    const { data: response } = await got(item.link);
                    const $detail = load(response);

                    // 移除广告和链接
                    $detail('[data-event-category="Article Link Display"]').remove();
                    $detail('#admbackgroud').remove();

                    // 获取发布时间
                    const authorElement = $detail('.author');
                    const authorText = authorElement.text().trim();
                    const dateMatch = authorText.match(/(\w+ \d{1,2}, \d{4}) \| ([\d:]+ [ap]m) [A-Z]+/);
                    item.pubDate = dateMatch ? timezone(parseDate(`${dateMatch[1]} ${dateMatch[2]}`), +7) : undefined;

                    // 获取文章内容
                    item.description = $detail('.fck_detail').html() || '';

                    return item;
                })
            )
        );

        return {
            title: `VNExpress | ${channels[channel]}`,
            link: rootUrl,
            item: items,
        };
    },
};
