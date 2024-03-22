// 导入必要的模组
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const channels = ['political', 'economic', 'society'];
    const rootUrl = 'https://cn.nhandan.vn';
    let items = [];

    for (const channel of channels) {
        const channelUrl = `${rootUrl}/${channel}/`;
        const response = await got(channelUrl);
        const $ = cheerio.load(response.body);

        const header = $('.rank-2 .story')
            .toArray()
            .map((element) => {
                const item = $(element);
                return {
                    title: item.find('h2 a').text(),
                    link: `${item.find('h2 a').attr('href')}`,
                };
            });

        const list = $('.box-content.content-list article')
            .toArray()
            .map((element) => {
                const item = $(element);
                return {
                    title: item.find('h2 a').text(),
                    link: `${item.find('h2 a').attr('href')}`,
                };
            });

        const newItems = await Promise.all(
            [...header, ...list].map((item) =>
                ctx.cache.tryGet(item.link, async () => {
                    const response = await got(item.link);
                    const $ = cheerio.load(response.body);

                    const datetime = $('time').attr('datetime');
                    item.pubDate = parseDate(datetime);

                    const descriptionSapo = $('table.picture').html();
                    const descriptionContent = $('.article__body.cms-body').html();

                    item.description = descriptionSapo + descriptionContent;

                    return item;
                })
            )
        );
        items = [...items, ...newItems];
    }

    ctx.state.data = {
        title: '越南人民报',
        description: '越南人民报中文版',
        link: `${rootUrl}`,
        item: items,
        author: 'Libukai',
    };
};
