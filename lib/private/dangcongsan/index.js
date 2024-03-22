// 导入必要的模组
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const rootUrl = 'https://cn.dangcongsan.vn';
    const response = await got(`${rootUrl}/cate-3085`);
    const $ = cheerio.load(response.body);

    const topNews = $('.main-content .top-news-cap2')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('h3 a').text(),
                link: `${item.find('h3 a').attr('href')}`,
            };
        });

    const subNews = $('.main-content .box-subnews .subnews-item')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('a').text(),
                link: `${item.find('a').attr('href')}`,
            };
        });

    const listNews = $('.main-content .ctrangc3 article')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('a').text(),
                link: `${item.find('a').attr('href')}`,
            };
        });

    const items = await Promise.all(
        [...topNews, ...subNews, ...listNews].map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.body);

                const datetime = $('.lbPublishedDate').text().replace('"', '');
                item.pubDate = parseDate(datetime);

                // 文章摘要
                const descriptionSummary = $('.post-summary');

                // 文章正文
                const descriptionContent = $('.post-content');

                // 拼接摘要和正文
                item.description = descriptionSummary.html() + descriptionContent.html();

                return item;
            })
        )
    );

    ctx.state.data = {
        title: '越南共产党电子报',
        description: '越南共产党电子报中文版',
        link: 'https://cn.dangcongsan.vn',
        item: items,
        author: 'Libukai',
    };
};
