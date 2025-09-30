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
    national: '时政',
    law: '法律',
    business: '经济',
    international: '国际',
    chinese: '华人动态',
    education: '教育',
    sports: '体育',
    technology: '科技',
    health: '健康-饮食',
    culture: '文娱',
    travel: '旅游',
} as const;

export const route: Route = {
    path: '/:channel?',
    categories: ['traditional-media'],
    example: '/sggp/national',
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
            source: ['cn.sggp.org.vn/:channel'],
            target: '/sggp/:channel',
        },
    ],
    name: '西贡解放日报',
    maintainers: ['Libukai'],
    handler: async (ctx) => {
        const channel = ctx.req.param('channel') || 'national';
        const rootUrl = 'https://cn.sggp.org.vn';
        const channelUrl = `${rootUrl}/${channels[channel]}`;

        const { data: response } = await got(channelUrl);
        const $ = load(response);

        // 获取头条新闻
        const headers: ArticleItem[] = $('.abf-homepage .story')
            .toArray()
            .map((element) => {
                const $item = $(element);
                const href = $item.find('h2 a').attr('href');
                return {
                    title: $item.find('h2 a').text(),
                    link: href ? String(href) : '',
                };
            });

        // 获取列表新闻
        const lists: ArticleItem[] = $('.box-content.content-list .story')
            .toArray()
            .map((element) => {
                const $item = $(element);
                const href = $item.find('h2 a').attr('href');
                return {
                    title: $item.find('h2 a').text(),
                    link: href ? String(href) : '',
                };
            });

        // 获取每篇文章的详细内容
        const items = await Promise.all(
            [...headers, ...lists].map((item) =>
                cache.tryGet(item.link, async () => {
                    const { data: response } = await got(item.link);
                    const $detail = load(response);

                    // 移除作者信息
                    $detail('.article__author.cms-author').remove();

                    const datetime = $detail('time').attr('datetime');
                    item.pubDate = datetime ? timezone(parseDate(datetime), +7) : undefined;

                    // 拼接文章摘要和正文
                    const sapo = $detail('.article__sapo.cms-desc').html() || '';
                    const body = $detail('.article__body.zce-content-body.cms-body').html() || '';
                    item.description = sapo + body;

                    return item;
                })
            )
        );

        return {
            title: `西贡解放日报 | ${channels[channel]}`,
            link: rootUrl,
            item: items,
        };
    },
};
