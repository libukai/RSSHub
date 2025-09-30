import { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';

const channels = {
    national: ['cate-3085', '今日越南'],
    world: ['cate-3086', '越南与世界'],
    business: ['cate-3087', '经济·投资'],
    culture: ['cate-3091', '文化·体育'],
    travel: ['cate-3089', '探索越南'],
    china: ['cate-317', '越中关系'],
} as const;

export const route: Route = {
    path: '/:channel?',
    categories: ['traditional-media'],
    example: '/dangcongsan/national',
    parameters: {
        channel: '频道，见下表，默认为 national',
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
            source: ['cn.dangcongsan.vn/:channel'],
            target: '/dangcongsan/:channel',
        },
    ],
    name: '越南共产党电子报',
    maintainers: ['Libukai'],
    handler: async (ctx) => {
        const channel = ctx.req.param('channel') || 'national';
        const rootUrl = 'https://cn.dangcongsan.vn';
        const channelUrl = `${rootUrl}/${channels[channel][0]}`;

        const response = await ofetch(channelUrl);
        const $ = load(response);

        // 获取头条新闻
        const topNews = $('.main-content .top-news-cap2')
            .toArray()
            .map((element) => {
                const item = $(element);
                const href = item.find('h3 a').attr('href');
                return {
                    title: item.find('h3 a').text(),
                    link: href ? String(href) : '',
                };
            });

        // 获取次要新闻
        const subNews = $('.main-content .box-subnews .subnews-item')
            .toArray()
            .map((element) => {
                const item = $(element);
                const href = item.find('a').attr('href');
                return {
                    title: item.find('a').text(),
                    link: href ? String(href) : '',
                };
            });

        // 获取列表新闻
        const listNews = $('.main-content .ctrangc3 article')
            .toArray()
            .map((element) => {
                const item = $(element);
                const href = item.find('a').attr('href');
                return {
                    title: item.find('a').text(),
                    link: href ? String(href) : '',
                };
            });

        // 获取每篇文章的详细内容
        const items = await Promise.all(
            [...topNews, ...subNews, ...listNews].map((item) =>
                cache.tryGet(item.link, async () => {
                    const response = await ofetch(item.link);
                    const $detail = load(response);

                    const datetime = $detail('.lbPublishedDate').text().replace('"', '');
                    item.pubDate = parseDate(datetime, 'dddd, DD/MM/YYYY HH:mm');

                    // 拼接文章摘要和正文
                    item.description = $detail('.post-summary').html() + $detail('.post-content').html();

                    return item;
                })
            )
        );

        return {
            title: `越南共产党电子报 | ${channels[channel][1]}`,
            link: rootUrl,
            item: items,
        };
    },
};
