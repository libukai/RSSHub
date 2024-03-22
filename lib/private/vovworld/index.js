// 导入必要的模组
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const rootUrl = 'https://vovworld.vn';
    const response = await got(`${rootUrl}/zh-CN/新闻/404.vov`);
    const $ = cheerio.load(response.body);

    const header = $('.cate-hl .story')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('h2 a').text(),
                link: `${rootUrl}${item.find('h2 a').attr('href')}`,
            };
        });

    const list = $('.cate-list .story')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('h2 a').text(),
                link: `${rootUrl}${item.find('h2 a').attr('href')}`,
            };
        });

    const items = await Promise.all(
        [...header, ...list].map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.body);

                const datetime = $('time').attr('datetime');
                item.pubDate = parseDate(datetime);

                // 文章摘要
                const descriptionSummary = $('.article__sapo.cms-desc');

                // 移除正文
                const descriptionContent = $('.article__body.cms-body');

                // 拼接头图和正文，并在段落间插入换行
                item.description = descriptionSummary.html() + descriptionContent.html();

                return item;
            })
        )
    );

    ctx.state.data = {
        title: '越南之声',
        description: '越南之声广播电台中文版新闻',
        link: `https://vovworld.vn/zh-CN.vov`,
        item: items,
        author: 'Libukai',
    };
};
