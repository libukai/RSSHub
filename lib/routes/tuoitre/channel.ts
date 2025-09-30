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
    'phap-luat': '法律',
    'kinh-doanh': '商业',
    'cong-nghe': '科技',
    xe: '汽车',
    'du-lich': '旅游',
    'nhip-song-tre': '时尚',
    'van-hoa': '文化',
    'giai-tri': '娱乐',
    'the-thao': '体育',
    'giao-duc': '教育',
    'nha-dat': '住房',
    'suc-khoe': '健康',
} as const;

export const route: Route = {
    path: '/:channel?',
    categories: ['traditional-media'],
    example: '/tuoitre/thoi-su',
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
            source: ['tuoitre.vn/:channel'],
            target: '/tuoitre/:channel',
        },
    ],
    name: '青年报',
    maintainers: ['Libukai'],
    handler: async (ctx) => {
        const channel = ctx.req.param('channel') || 'thoi-su';
        const rootUrl = 'https://tuoitre.vn';
        const channelUrl = `${rootUrl}/${channel}.htm`;

        const { data: response } = await got(channelUrl);
        const $ = load(response);

        // 获取头条新闻
        const headers: ArticleItem[] = $('[data-boxtype="zonenewsposition"]')
            .toArray()
            .map((element) => {
                const $item = $(element);
                const href = $item.find('h2 a').attr('href');
                const title = $item.find('h2 a').attr('title');
                return {
                    title: title ? String(title) : '',
                    link: href ? rootUrl + String(href) : '',
                };
            });

        // 获取次要新闻
        const subs: ArticleItem[] = $('[data-boxtype="homenewsposition"]')
            .toArray()
            .map((element) => {
                const $item = $(element);
                const href = $item.find('h3 a').attr('href');
                const title = $item.find('h3 a').attr('title');
                return {
                    title: title ? String(title) : '',
                    link: href ? rootUrl + String(href) : '',
                };
            });

        // 获取列表新闻
        const lists: ArticleItem[] = $('.list__listing-main .box-category-item')
            .toArray()
            .map((element) => {
                const $item = $(element);
                const href = $item.find('h3 a').attr('href');
                const title = $item.find('h3 a').attr('title');
                return {
                    title: title ? String(title) : '',
                    link: href ? rootUrl + String(href) : '',
                };
            });

        // 获取每篇文章的详细内容
        const items: ArticleItem[] = await Promise.all(
            [...headers, ...subs, ...lists].map((item) =>
                cache.tryGet(item.link, async () => {
                    const { data: response } = await got(item.link);
                    const $detail = load(response);

                    // 移除相关新闻
                    $detail('div[type="RelatedOneNews"]').remove();
                    $detail('div[type="RelatedNewsBox"]').remove();

                    // 获取发布时间
                    const datetime = $detail('[data-role="publishdate"]').text().trim().replace(' GMT+7', '');
                    item.pubDate = datetime ? timezone(parseDate(datetime, 'DD/MM/YYYY HH:mm'), +7) : undefined;

                    // 获取文章内容
                    const subheadline = $detail('.detail-sapo').html();
                    const content = $detail('.detail-content.afcbc-body').html();
                    item.description = (subheadline || '') + (content || '');

                    return item;
                })
            )
        );

        return {
            title: `青年日报 | ${channels[channel]}`,
            link: rootUrl,
            item: items,
        };
    },
};
