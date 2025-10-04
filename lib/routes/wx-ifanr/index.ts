import { DataItem, Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import { load } from 'cheerio';

export const route: Route = {
    path: '/',
    categories: ['new-media'],
    example: '/wx-ifanr',
    name: '爱范儿微信公众号',
    maintainers: ['likai'],
    description: `
处理由今天看啥抓取的爱范儿微信公众号 RSS，清理文末的推广内容:
    `,
    handler,
};

async function handler(ctx) {
    // 硬编码爱范儿的今天看啥 RSS ID
    const rssUrl = 'https://rss.jintiankansha.me/rss/GY2XYZRZGYYGCNZWMFSTMZBQG5SDAMJZGEZTOYTEMFRWCMRUMY4GIYLCMEYWKMRYMU2TO===';

    // 1. 获取原始 RSS
    const { data: response } = await got({
        method: 'get',
        url: rssUrl,
    });

    // 2. 解析 RSS XML
    const $ = load(response, { xmlMode: true });

    // 3. 提取 Feed 基本信息
    const feedTitle = $('channel > title').text();
    const feedLink = $('channel > link').text();
    const feedDescription = $('channel > description').text();

    // 4. 处理每个 item
    const items: DataItem[] = [];

    for (const item of $('item')
        .toArray()
        .slice(0, ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit'), 10) : 20)) {
        const $item = $(item);

        // 提取基本信息
        const title = $item.find('title').text();
        const link = $item.find('link').text();
        const pubDate = $item.find('pubDate').text();
        const category = $item.find('category').text();

        // 提取 description 中的 HTML 内容 (使用 .text() 处理 CDATA)
        let descriptionHtml = $item.find('description').text();

        // === 关键: 清理 description 中的 HTML ===
        if (descriptionHtml) {
            // 使用 Cheerio 加载 HTML 内容
            const $desc = load(descriptionHtml);

            // 1. 只保留 js_content 节点,删除其兄弟节点
            const jsContent = $desc('#js_content');
            if (jsContent.length > 0) {
                jsContent.siblings().remove();
            }

            // 2. 在 js_content 中找到 class="js_darkmode__49" 的 section (招聘信息开始),删除它及之后的兄弟节点
            const darkModeSection = $desc('section[class^="js_darkmode__"]').first();
            if (darkModeSection.length > 0) {
                darkModeSection.nextAll().remove();
                darkModeSection.remove();
            }

            // 获取清理后的 HTML
            descriptionHtml = $desc('body').html() || '';
        }

        // 构造 RSSHub 标准格式的 item
        items.push({
            title,
            link,
            description: descriptionHtml,
            pubDate: pubDate ? parseDate(pubDate) : undefined,
            category: category ? [category] : undefined,
            author: feedTitle.replace(/\s*-\s*今天看啥\s*$/, ''), // 使用 feed 标题作为作者，去掉后缀
        });
    }

    // 5. 返回 RSSHub 标准格式
    return {
        title: feedTitle.replace(/\s*-\s*今天看啥\s*$/, ''),
        link: feedLink,
        description: feedDescription,
        item: items,
    };
}
