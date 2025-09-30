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
    description?: string | null;
}

export const route: Route = {
    path: '/',
    categories: ['traditional-media'],
    example: '/chosun',
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
            source: ['cnnews.chosun.com/'],
            target: '/chosun',
        },
    ],
    name: '朝鲜日报中文网',
    maintainers: ['Libukai'],
    handler: async () => {
        const rootUrl = 'https://cnnews.chosun.com/';

        const { data: response } = await got(rootUrl);
        const $ = load(response);

        // 获取头条文章
        const headers: ArticleItem[] = $('.headtop.slider > div')
            .toArray()
            .map((element) => {
                const item = $(element);
                return {
                    title: item.find('.txt strong').text(),
                    link: `${rootUrl}${item.find('a').attr('href')}`,
                };
            });

        // 获取列表文章
        const lists: ArticleItem[] = $('.Top_news2 li .tit')
            .toArray()
            .map((element) => {
                const item = $(element);
                const subtitle = item.find('p').text();
                return {
                    title: item.find('a').text().replace(subtitle, ''),
                    link: `${rootUrl}${item.find('a').attr('href')}`,
                };
            });

        // 获取每篇文章的详细内容
        const items = await Promise.all(
            [...headers, ...lists].map((item) =>
                cache.tryGet(item.link, async () => {
                    const { data: response } = await got(item.link);
                    const $detail = load(response);

                    // 从 date_text 中提取发布时间
                    const dateText = $detail('.date_text p').text();
                    const inputDate = dateText.match(/输入 : ([\d-]+)/)?.[1];
                    const inputTime = dateText.match(/(\d{2}:\d{2})/)?.[1];
                    item.pubDate = timezone(parseDate(`${inputDate} ${inputTime}`), +9);

                    item.description = $detail('.article_body').html();
                    return item;
                })
            )
        );

        return {
            title: '朝鲜日报中文网',
            link: rootUrl,
            item: items.map((item) => ({
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                description: item.description || undefined,
            })),
        };
    },
};
