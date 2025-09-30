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

export const route: Route = {
    path: '/:channel?',
    categories: ['traditional-media'],
    example: '/nhandan/political',
    parameters: {
        channel: '频道代码',
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
            source: ['cn.nhandan.vn/:channel'],
            target: '/nhandan/:channel',
        },
    ],
    name: '频道',
    maintainers: ['Libukai'],
    handler: async (ctx) => {
        const channel = ctx.req.param('channel') || 'political';
        const rootUrl = 'https://cn.nhandan.vn';
        const channelUrl = `${rootUrl}/${channel}/`;

        const { data: response } = await got(channelUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });
        const $ = load(response);

        // 获取头条文章（.abf-cate 区域）
        const headers: ArticleItem[] = $('.abf-cate article')
            .toArray()
            .map((element) => {
                const $header = $(element);
                const a = $header.find('h2 a');
                const link = a.attr('href');
                return {
                    title: a.text().trim(),
                    link: link?.startsWith('http') ? link : `${rootUrl}${link}`,
                };
            });

        // 获取列表文章（timeline content-list 区域）
        const lists: ArticleItem[] = $('.timeline.content-list article')
            .toArray()
            .map((element) => {
                const $list = $(element);
                const a = $list.find('h2 a, h4 a');
                const link = a.attr('href');
                return {
                    title: a.text().trim(),
                    link: link?.startsWith('http') ? link : `${rootUrl}${link}`,
                };
            });

        // 获取每篇文章的详细内容
        const items = await Promise.all(
            [...headers, ...lists].map((item) =>
                cache.tryGet(item.link, async () => {
                    const { data: response } = await got(item.link, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        },
                    });
                    const $detail = load(response);

                    const datetime = $detail('.article__meta time').attr('datetime');
                    item.pubDate = datetime ? timezone(parseDate(datetime), +7) : undefined;

                    const picture = $detail('table.picture').html() || '';
                    const body = $detail('.article__body.cms-body').html() || '';
                    item.description = picture + body;

                    return item;
                })
            )
        );

        const channels = {
            political: '政治',
            economic: '经济',
            society: '社会',
            culture: '文化',
            sports: '体育',
            international: '国际',
            tourism: '旅游',
            fb_vietnam_china: '中越友谊',
        };

        return {
            title: `越南人民报 | ${channels[channel]}`,
            link: rootUrl,
            item: items,
        };
    },
};
