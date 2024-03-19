// 导入必要的模组
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');
const dayjs = require('dayjs');

module.exports = async (ctx) => {
    const rootUrl = 'https://sputniknews.cn';
    const response = await got(`${rootUrl}/china/`);
    const $ = cheerio.load(response.body);

    const list = $('.list__item')
        .toArray()
        .map((element) => {
            const item = $(element);
            return {
                title: item.find('.list__content > a').attr('title'),
                link: `${rootUrl}${item.find('.list__content a').attr('href')}`,
            };
        });

    const items = await Promise.all(
        list.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const response = await got(item.link);
                const $ = cheerio.load(response.body);

                const datetime = $('.article__info-date a').attr('data-unixtime');
                item.pubDate = dayjs.unix(datetime);

                // 拼接头图和正文
                const $headerCopy = $('.article__header').clone();
                $headerCopy.find('.article__title').remove();
                $headerCopy.find('.article__info').remove();
                $headerCopy.find('.article__news-services-subscribe').remove();
                const descriptionHeader = $headerCopy.html();
                const descriptionBody = $('.article__body').html();
                item.description = descriptionHeader + descriptionBody;

                return item;
            })
        )
    );

    ctx.state.data = {
        title: '俄罗斯卫星通讯社',
        description: '俄罗斯卫星通讯社实时新闻',
        link: 'https://sputniknews.cn/',
        item: items,
        author: 'Libukai',
    };
};
