// 导入必要的模组
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const rootUrl = 'https://udn.com';
    const response = await got(`${rootUrl}/news/cate/2/6640`);
    const $ = cheerio.load(response.body);

    const list = $('.thumb-news')
        .first()
        .find('.story-list__news')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('.story-list__text h3').text(),
                link: `${rootUrl}${item.find('.story-list__text a').attr('href')}`,
            };
        });

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.body);

                const description = $('.article-content__editor').html();

                if (!description) {
                    return null;
                } else {
                    item.description = description;
                    return item;
                }
            })
        )
    );

    ctx.state.data = {
        title: '联合新闻网',
        description: '联合新闻网两岸频道',
        link: 'https://udn.com/news',
        item: items.filter((item) => item !== null),
        author: 'Libukai',
    };
};
