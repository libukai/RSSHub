import { Route } from '@/types';
import { parseWechatRss } from '@/utils/jtks/rss-parser';
import type { WechatSourceConfig } from '@/utils/jtks/types';

const config: WechatSourceConfig = {
    name: 'xinzhiyuan',
    displayName: '新智元',
    rssUrl: 'https://rss.jintiankansha.me/rss/GEYDONJSPQ3WGYLEGJTGEODCMZRTQZJSMZTDSNRUHEZWKY3CGU3GIYZQGM4DGMBYGVTDOYRVGU======',
    cleanRules: [
        {
            description: '只保留正文内容区域 (#js_content)',
            selector: '#js_content',
            action: 'keep-only',
        },
        {
            description: '删除"参考资料"section 及之后内容',
            selector: 'section',
            action: 'remove-after',
            textMatch: {
                type: 'contains',
                value: '参考资料',
            },
        },
    ],
};

export const route: Route = {
    path: '/',
    categories: ['new-media'],
    example: '/wx-xinzhiyuan',
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
