/**
 * 今天看啥微信公众号 RSS 处理工具 - RSS 解析器
 */

import type { DataItem } from '@/types';
import type { WechatSourceConfig } from './types';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import { cleanWechatHtml } from './html-cleaner';

/**
 * 解析微信公众号 RSS (今天看啥源)
 * @param config 微信源配置
 * @param limit 返回项数限制
 * @returns RSS feed 数据
 */
export async function parseWechatRss(
    config: WechatSourceConfig,
    limit: number = 20
): Promise<{
    title: string;
    link: string;
    description: string;
    item: DataItem[];
}> {
    // 1. 获取原始 RSS XML
    const { data: rssData } = await got(config.rssUrl);

    // 2. 解析 RSS (必须使用 xmlMode: true)
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

        // 5. 清理 HTML 内容
        if (descriptionHtml) {
            descriptionHtml = cleanWechatHtml(descriptionHtml, config.cleanRules);
        }

        // 6. 构造 RSSHub 标准格式的 item
        items.push({
            title,
            link,
            description: descriptionHtml,
            pubDate: pubDate ? parseDate(pubDate) : undefined,
            category: category ? [category] : undefined,
            author: feedTitle.replace(/\s*-\s*今天看啥\s*$/, ''), // 使用 feed 标题作为作者，去掉后缀
        });
    }

    // 7. 返回 RSSHub 标准格式
    return {
        title: feedTitle.replace(/\s*-\s*今天看啥\s*$/, ''),
        link: feedLink,
        description: feedDescription,
        item: items,
    };
}
