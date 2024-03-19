// 导入必要的模组
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const rootUrl = 'https://www.dw.com';
    const response = await got(`${rootUrl}/zh`);
    const $ = cheerio.load(response.body);

    const header = $('.imgTeaserXL.cinemaXL')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('.teaserContentWrap a h2').text(),
                link: `${rootUrl}${item.find('.teaserContentWrap a').attr('href')}`,
            };
        });

    const list = $('.col2.left .news')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('h2').text(),
                link: `${rootUrl}${item.find('a').attr('href')}`,
            };
        });

    const items = await Promise.all(
        [...header, ...list].map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.body);

                // 拼接头图和正文，并在段落间插入换行
                item.description = $('.longText').html();

                return item;
            })
        )
    );

    ctx.state.data = {
        title: '德国之声',
        description: '德国之声中文网',
        link: 'https://www.dw.com/zh',
        item: items,
        author: 'Libukai',
    };
};
