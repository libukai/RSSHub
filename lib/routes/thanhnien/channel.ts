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
    'thoi-su': '时事',
    'the-gioi': '世界',
    'kinh-te': '商业',
    'doi-song': '生活',
    'suc-khoe': '健康',
    'gioi-tre': '青年',
    'cong-nghe': '科技',
    'giao-duc': '教育',
    'du-lich': '旅游',
    'van-hoa': '文化',
    'giai-tri': '娱乐',
    'the-thao': '体育',
    xe: '汽车',
} as const;

export const route: Route = {
    path: '/:channel?',
    categories: ['traditional-media'],
    example: '/thanhnien/thoi-su',
    parameters: {
        channel: '频道，见下表，默认为 thoi-su',
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
            source: ['thanhnien.vn/:channel'],
            target: '/thanhnien/:channel',
        },
    ],
    name: '青年报',
    maintainers: ['Libukai'],
    handler: async (ctx) => {
        const channel = ctx.req.param('channel') || 'thoi-su';
        const rootUrl = 'https://thanhnien.vn';
        const channelUrl = `${rootUrl}/${channel}`;

        const { data: response } = await got(channelUrl);
        const $ = load(response);

        // 获取头条新闻
        const headers: ArticleItem[] = $('.list__focus-main .box-category-item-main, .list__focus-main .box-category-item')
            .toArray()
            .map((element) => {
                const $item = $(element);
                const href = $item.find('a').attr('href');
                const title = $item.find('a').attr('title');
                return {
                    title: title ? String(title) : '',
                    link: href ? rootUrl + String(href) : '',
                };
            });

        // 获取列表新闻
        const lists: ArticleItem[] = $('.list__stream-main .box-category-item')
            .toArray()
            .map((element) => {
                const $item = $(element);
                const href = $item.find('a').attr('href');
                const title = $item.find('a').attr('title');
                return {
                    title: title ? String(title) : '',
                    link: href ? rootUrl + String(href) : '',
                };
            });

        // 获取每篇文章的详细内容
        const items: ArticleItem[] = await Promise.all(
            [...headers, ...lists].map((item) =>
                cache.tryGet(item.link, async () => {
                    const { data: response } = await got(item.link);
                    const $detail = load(response);

                    // 获取发布时间
                    const pubDateText = $detail('div[data-role="publishdate"]').text().replace('GMT+7', '').trim();
                    item.pubDate = pubDateText ? timezone(parseDate(pubDateText, 'DD/MM/YYYY HH:mm'), +7) : undefined;

                    // 获取文章内容
                    item.description = $detail('.detail-cmain, .detail__magazine').html() || '';

                    return item;
                })
            )
        );

        return {
            title: `青年报 | ${channels[channel]}`,
            link: rootUrl,
            item: items,
        };
    },
};
