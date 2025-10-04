import { DataItem, Route } from '@/types';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import { load } from 'cheerio';

export const route: Route = {
    path: '/',
    categories: ['new-media'],
    example: '/wx-xinzhiyuan',
    name: '新智元微信公众号',
    maintainers: ['likai'],
    description: `
处理由今天看啥抓取的新智元微信公众号 RSS，处理文末的推广图片内容:
    `,
    handler,
};

async function handler(ctx) {
    // 硬编码新智元的今天看啥 RSS ID
    const rssUrl = 'https://rss.jintiankansha.me/rss/GEYDONJSPQ3WGYLEGJTGEODCMZRTQZJSMZTDSNRUHEZWKY3CGU3GIYZQGM4DGMBYGVTDOYRVGU======';

    // 获取 limit 参数
    const limit = ctx.req.query('limit') ? Math.min(Number.parseInt(ctx.req.query('limit'), 10), 100) : 20;

    // 1. 获取原始 RSS
    const { data: rssData } = await got(rssUrl);

    // 2. 解析 RSS (XML 模式)
    const $ = load(rssData, { xmlMode: true });

    // 3. 提取 Feed 基本信息
    const feedTitle = $('channel > title').text();
    const feedLink = $('channel > link').text();
    const feedDescription = $('channel > description').text();

    // 4. 处理每个 item
    const items: DataItem[] = [];

    for (const item of $('item').toArray().slice(0, limit)) {
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

            // 2. 删除"参考资料"及其之后的所有内容
            const referenceSection = $desc('section:contains("参考资料")');
            if (referenceSection.length > 0) {
                referenceSection.nextAll().remove();
                referenceSection.remove();
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
