import { Route } from '@/types';
import { parseWechatRss } from '@/utils/jtks/rss-parser';
import type { WechatSourceConfig } from '@/utils/jtks/types';

const config: WechatSourceConfig = {
    name: 'huxiu',
    displayName: '虎嗅APP',
    rssUrl: 'http://rss.jintiankansha.me/rss/GZ6DGNRZGUYDQMDEGEYDGMLBMU4DCMBQGRRGEMJXGNTDMOBXGI2GGNJSGQ2TEYTBG43A====',
    cleanRules: [
        {
            description: '只保留正文内容区域 (#js_content)',
            selector: '#js_content',
            action: 'keep-only',
        },
        {
            description: '删除"本内容为作者独立观点"及之后内容',
            selector: 'span[leaf]',
            action: 'remove-parent-after',
            textMatch: {
                type: 'startsWith',
                value: '本内容为作者独立观点',
            },
        },
    ],
};

export const route: Route = {
    path: '/',
    categories: ['new-media'],
    example: '/wx-huxiu',
    name: `${config.displayName}微信公众号`,
    maintainers: ['likai'],
    description: `
处理由今天看啥抓取的${config.displayName}微信公众号 RSS。

自动清理的内容:
${config.cleanRules.map((rule) => `- ${rule.description}`).join('\n')}
    `,
    handler,
};

async function handler(ctx) {
    const limit = ctx.req.query('limit') ? Math.min(Number.parseInt(ctx.req.query('limit'), 10), 100) : 20;
    return await parseWechatRss(config, limit);
}
