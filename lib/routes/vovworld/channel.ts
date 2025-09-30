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
    news: ['新闻', '404'],
    business: ['越南经济', '564'],
    travel: ['探索越南', '282'],
    culture: ['越南文化', '281'],
    china: ['越中关系', '292'],
} as const;

export const route: Route = {
    path: '/:channel?',
    categories: ['traditional-media'],
    example: '/vovworld/news',
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
            source: ['vovworld.vn/zh-CN/:channel'],
            target: '/vovworld/:channel',
        },
    ],
    name: '越南之声',
    maintainers: ['Libukai'],
    handler: async (ctx) => {
        const channel = ctx.req.param('channel') || 'news';
        const rootUrl = 'https://vovworld.vn';
        const channelUrl = `${rootUrl}/zh-CN/${channels[channel][0]}/${channels[channel][1]}.vov`;

        const { data: response } = await got(channelUrl);
        const $ = load(response);

        // 获取头条新闻
        const headers: ArticleItem[] = $('.cate-hl .story')
            .toArray()
            .map((element) => {
                const $item = $(element);
                const href = $item.find('h2 a').attr('href');
                const title = $item.find('h2 a').text();
                return {
                    title: title || '',
                    link: href ? rootUrl + String(href) : '',
                };
            });

        // 获取列表新闻
        const lists: ArticleItem[] = $('.cate-list .story')
            .toArray()
            .map((element) => {
                const $item = $(element);
                const href = $item.find('h2 a').attr('href');
                const title = $item.find('h2 a').text();
                return {
                    title: title || '',
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
                    const datetime = $detail('time').text().replace('| ', '');
                    item.pubDate = datetime ? timezone(parseDate(datetime, 'YYYY年M月D日 HH:mm:ss', 'zh-cn'), +7) : undefined;

                    // 获取文章内容
                    const summary = $detail('.article__sapo.cms-desc').html() || '';
                    const content = $detail('.article__body.cms-body').html() || '';
                    // 在每个 div 后添加换行，除非后面紧跟着段落
                    item.description = (summary + content).replaceAll(/<\/div>(?!\s*<p>)/g, '</div></br>');

                    return item;
                })
            )
        );

        return {
            title: `越南之声 | ${channels[channel][0]}`,
            link: rootUrl,
            item: items,
        };
    },
};
