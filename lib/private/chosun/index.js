// 导入必要的模组
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const rootUrl = 'https://cnnews.chosun.com/';
    const response = await got(rootUrl);
    const $ = cheerio.load(response.body);

    const header = $('.headtop.slider > div')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('.txt strong').text(),
                link: `${rootUrl}${item.find('a').attr('href')}`,
            };
        });

    const list = $('.Top_news2 li .tit')
        .toArray()
        .map((element) => {
            const item = $(element);
            const subtitle = item.find('p').text();
            return {
                title: item.find('a').text().replace(subtitle, ''),
                link: `${rootUrl}${item.find('a').attr('href')}`,
            };
        });

    const items = await Promise.all(
        [...header, ...list].map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.body);

                item.description = $('.article_body').html();

                return item;
            })
        )
    );

    ctx.state.data = {
        title: '朝鲜日报',
        description: '朝鲜日报中文网',
        link: 'https://cnnews.chosun.com',
        item: items,
        author: 'Libukai',
    };
};
