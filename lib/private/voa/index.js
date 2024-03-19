// 导入必要的模组
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const rootUrl = 'https://www.voachinese.com';
    const response = await got(`${rootUrl}/z/1757`);
    const $ = cheerio.load(response.body);

    const list = $('.pull-left.content-offset .media-block')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('h4').text(),
                link: `${rootUrl}${item.find('a').attr('href')}`,
            };
        });

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.body);

                item.description = $('.wsw').html();

                return item;
            })
        )
    );

    ctx.state.data = {
        title: 'VOA',
        description: '美国之音中文网',
        link: 'https://www.voachinese.com/',
        item: items,
        author: 'Libukai',
    };
};
