// 导入必要的模组
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const rootUrl = 'https://zh.vietnamplus.vn';
    const response = await got(`${rootUrl}/mostrecent.vnp`);
    const $ = cheerio.load(response.body);

    const list = $('.zone--timeline .story')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('h2 a').text(),
                link: `${rootUrl}${item.find('h2 a').attr('href')}`,
            };
        });

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.body);

                const datetime = $('time').attr('datetime');
                item.pubDate = parseDate(datetime);

                // 拼接头图和正文，并在段落间插入换行
                item.description = $('.content.article-body').html();

                return item;
            })
        )
    );

    ctx.state.data = {
        title: '越通社',
        description: '越通社中文版新闻',
        link: `https://zh.vietnamplus.vn/`,
        item: items,
        author: 'Libukai',
    };
};
