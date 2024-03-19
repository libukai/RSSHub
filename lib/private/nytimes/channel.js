// 导入必要的模组
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const channel = ctx.params.channel || 'china';
    const rootUrl = 'https://cn.nytimes.com';
    const response = await got(`${rootUrl}/${channel}`);
    const $ = cheerio.load(response.body);

    const header = $('.collection-item.first.last')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('h3 a').text(),
                link: `${rootUrl}${item.find('h3 a').attr('href')}`,
                author: item.find('.byline').text(),
            };
        });

    const list = $('.autoList li')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('h3 a').text(),
                link: `${rootUrl}${item.find('h3 a').attr('href')}`,
                author: item.find('.byline').text(),
            };
        });

    const items = await Promise.all(
        [...header, ...list].map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.body);

                const datetime = $('time').attr('datetime');
                item.pubDate = parseDate(datetime || new Date().toUTCString());

                // 移除文章中的广告位
                $('.big_ad').remove();

                // 移除文章末尾的作者信息
                $('.author-info').remove();

                // 拼接头图和正文，并在段落间插入换行
                const descriptionRaw = `${$('.article-span-photo').html()}<br>${$('.article-left').html()}`;
                item.description = descriptionRaw.replaceAll(/(<\/div>)/g, '$1<br>').replaceAll(/(<\/div><br>)+/g, '$1');

                return item;
            })
        )
    );

    ctx.state.data = {
        title: '纽约时报',
        description: '纽约时报中文网，可以单独抓取频道',
        link: `${rootUrl}/${channel}`,
        item: items,
        author: 'Libukai',
    };
};
