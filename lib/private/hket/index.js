// 导入必要的模组
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const rootUrl = 'https://china.hket.com';
    const response = await got(`${rootUrl}/srac002/即時中國`);
    const $ = cheerio.load(response.body);

    const list = $('.template-default > .template_item.hket-col-xs-60 ')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('a').first().text(),
                link: `${rootUrl}${item.find('a').first().attr('href')}`,
            };
        });

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.body);

                item.description = $('.article-detail-content-container')
                    .html()
                    ?.replace(/<p>責任[\s\S]*$/, '');

                return item;
            })
        )
    );

    ctx.state.data = {
        title: '香港经济日报',
        description: '香港经济日报中国频道',
        link: 'https://www.hket.com/',
        item: items,
        author: 'Libukai',
    };
};
