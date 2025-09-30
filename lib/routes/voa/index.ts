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
    path: '/',
    categories: ['traditional-media'],
    example: '/voa',
    parameters: {},
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
            source: ['voachinese.com/z/1757'],
            target: '/voa',
        },
    ],
    name: '美国之音',
    maintainers: ['Libukai'],
    handler: async () => {
        const rootUrl = 'https://www.voachinese.com';
        const { data: response } = await got(`${rootUrl}/z/1739`);
        const $ = load(response);

        const list: ArticleItem[] = $('.media-block')
            .toArray()
            .map((element) => {
                const $item = $(element);
                const $link = $item.find('.media-block__content a');
                const href = $link.attr('href');
                const title = $link.find('h4').text();
                return {
                    title: title || '',
                    link: href ? rootUrl + String(href) : '',
                };
            });

        const items: ArticleItem[] = await Promise.all(
            list.map((item) =>
                cache.tryGet(item.link, async () => {
                    const { data: response } = await got(item.link);
                    const $detail = load(response);
                    const time = $detail('.published .date time').attr('datetime');
                    item.pubDate = time ? timezone(parseDate(time), -5) : undefined;
                    item.description = $detail('.wsw').html() || '';

                    return item;
                })
            )
        );

        return {
            title: 'VOA',
            description: '美国之音中文网',
            link: rootUrl,
            item: items,
        };
    },
};
