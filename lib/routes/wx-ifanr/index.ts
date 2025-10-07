import { Route } from '@/types';
import { parseWechatRss } from '@/utils/jtks/rss-parser';
import type { WechatSourceConfig } from '@/utils/jtks/types';

const config: WechatSourceConfig = {
    name: 'ifanr',
    displayName: '爱范儿',
    rssUrl: 'https://rss.jintiankansha.me/rss/GY2XYZRZGYYGCNZWMFSTMZBQG5SDAMJZGEZTOYTEMFRWCMRUMY4GIYLCMEYWKMRYMU2TO===',
    cleanRules: [
        {
            description: '只保留正文内容区域 (#js_content)',
            selector: '#js_content',
            action: 'keep-only',
        },
        {
            description: '删除招聘信息 (js_darkmode__* 类名的 section)',
            selector: 'section',
            action: 'remove-after',
            attrMatch: {
                name: 'class',
                pattern: '^js_darkmode__',
            },
        },
    ],
};

export const route: Route = {
    path: '/',
    categories: ['new-media'],
    example: '/wx-ifanr',
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
