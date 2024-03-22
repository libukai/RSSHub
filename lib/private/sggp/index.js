// 导入必要的模组
const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');

module.exports = async (ctx) => {
    const channels = ['时政', '法律', '经济', '教育', '体育'];
    const rootUrl = 'https://cn.sggp.org.vn';
    let items = [];

    for (const channel of channels) {
        const channelUrl = `${rootUrl}/${channel}`;
        const response = await got(channelUrl);
        const $ = cheerio.load(response.body);

        const header = $('.abf-cate .story')
            .toArray()
            .map((element) => {
                const item = $(element);
                return {
                    title: item.find('h2 a').text(),
                    link: `${item.find('h2 a').attr('href')}`,
                };
            });

        const list = $('.box-content.content-list .story')
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

                    const descriptionSapo = $('.article__sapo.cms-desc').html();
                    const descriptionContent = $('.article__body.zce-content-body.cms-body').html();

                    item.description = descriptionSapo + descriptionContent;

                    return item;
                })
            )
        );
        items = [...items, ...newItems];
    }

    ctx.state.data = {
        title: '西贡解放日报',
        description: '西贡解放日报中文版',
        link: `${rootUrl}`,
        item: items,
        author: 'Libukai',
    };
};
