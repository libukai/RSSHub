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
    politics: '时政',
    world: '国际',
    business: '经济',
    social: '社会',
    sports: '体育',
    culture: '文化',
    technology: '科技',
    environment: '环保',
    travel: '旅游',
} as const;

export const route: Route = {
    path: '/:channel?',
    categories: ['traditional-media'],
    example: '/vietnamplus/politics',
    parameters: {
        channel: '频道，见下表，默认为 politics',
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
            source: ['zh.vietnamplus.vn/:channel'],
            target: '/vietnamplus/:channel',
        },
    ],
    name: '越通社',
    maintainers: ['Libukai'],
    handler: async (ctx) => {
        const channel = ctx.req.param('channel') || 'politics';
        const rootUrl = 'https://zh.vietnamplus.vn';
        const channelUrl = `${rootUrl}/${channel}/`;

        const { data: response } = await got(channelUrl);
        const $ = load(response);

        // 获取头条新闻
        const headers: ArticleItem[] = $('.abf-cate .story')
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

        // 获取列表新闻
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
            [...headers, ...lists].map((item) =>
                cache.tryGet(item.link, async () => {
                    const { data: response } = await got(item.link);
                    const $detail = load(response);

                    // 获取发布时间
                    const datetime = $detail('time').attr('datetime');
                    item.pubDate = datetime ? timezone(parseDate(datetime), +7) : undefined;

                    // 处理文章内容中的图片
                    let rawBody = $detail('.article__body').html() || '';

                    const $rawBody = load(rawBody);
                    // 处理延迟加载的图片
                    $rawBody('img[data-src]').each((_, element) => {
                        const img = $rawBody(element);
                        const dataSrc = img.attr('data-src');
                        if (dataSrc) {
                            img.attr('src', dataSrc);
                        }
                    });
                    // 移除文章末尾的"（完）"
                    rawBody = $rawBody.html()?.replace(/（完）.*$/, '') || '';

                    item.description = rawBody;
                    return item;
                })
            )
        );

        return {
            title: `越通社 | ${channels[channel]}`,
            link: rootUrl,
            item: items,
        };
    },
};
