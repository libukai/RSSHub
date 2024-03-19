// 导入必要的模组
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const rootUrl = 'https://cn.nikkei.com';

    const chinaResponse = await got(`${rootUrl}/china.html`);
    let $ = cheerio.load(chinaResponse.body);

    const chinaHeader = $('.newsDetail01.mB10')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('a').first().text(),
                link: `${rootUrl}${item.find('a').attr('href')}`,
            };
        });

    const chinalist = $('.newsContent02 dt')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('a').text(),
                link: `${rootUrl}${item.find('a').attr('href')}`,
            };
        });

    const japanResponse = await got(`${rootUrl}/politicsaeconomy.html`);
    $ = cheerio.load(japanResponse.body);

    const japanHeader = $('.newsDetail01.mB10')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('a').first().text(),
                link: `${rootUrl}${item.find('a').attr('href')}`,
            };
        });

    const japanlist = $('.newsContent02 dt')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('a').text(),
                link: `${rootUrl}${item.find('a').attr('href')}`,
            };
        });

    const items = await Promise.all(
        [...chinaHeader, ...chinalist, ...japanHeader, ...japanlist].map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.body);

                // 拼接头图和正文，并在段落间插入换行
                item.description = $('.newsText.fix').html();

                return item;
            })
        )
    );

    ctx.state.data = {
        title: '日经中文网',
        description: '日经新闻中文版网站',
        link: `https://cn.nikkei.com/`,
        item: items,
        author: 'Libukai',
    };
};
