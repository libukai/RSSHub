import { Route } from '@/types';
import got from '@/utils/got';
import cache from './cache';
import { config } from '@/config';
import utils from './utils';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/watchlater/:uid/:disableEmbed?',
    categories: ['social-media'],
    example: '/bilibili/watchlater/2267573',
    parameters: { uid: '用户 id', disableEmbed: '默认为开启内嵌视频, 任意值为关闭' },
    features: {
        requireConfig: true,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: '用户稍后再看',
    maintainers: ['JimenezLi'],
    handler,
    description: `:::warning
  用户稍后再看需要 b 站登录后的 Cookie 值，所以只能自建，详情见部署页面的配置模块。
  :::`,
};

async function handler(ctx) {
    const uid = ctx.req.param('uid');
    const disableEmbed = ctx.req.param('disableEmbed');
    const name = await cache.getUsernameFromUID(uid);

    const cookie = config.bilibili.cookies[uid];
    if (cookie === undefined) {
        throw new Error('缺少对应 uid 的 Bilibili 用户登录后的 Cookie 值');
    }

    const response = await got({
        method: 'get',
        url: `https://api.bilibili.com/x/v2/history/toview`,
        headers: {
            Referer: `https://space.bilibili.com/${uid}/`,
            Cookie: cookie,
        },
    });
    if (response.data.code) {
        const message = response.data.code === -6 ? '对应 uid 的 Bilibili 用户的 Cookie 已过期' : response.data.message;
        throw new Error(`Error code ${response.data.code}: ${message}`);
    }
    const list = response.data.data.list || [];

    const out = list.map((item) => ({
        title: item.title,
        description: `${item.desc}<br><br><a href="https://www.bilibili.com/list/watchlater?bvid=${item.bvid}">在稍后再看列表中查看</a>${disableEmbed ? '' : `<br><br>${utils.iframe(item.aid)}`}<br><img src="${item.pic}">`,
        pubDate: parseDate(item.add_at * 1000),
        link: item.pubdate > utils.bvidTime && item.bvid ? `https://www.bilibili.com/video/${item.bvid}` : `https://www.bilibili.com/video/av${item.aid}`,
        author: item.owner.name,
    }));

    return {
        title: `${name} 稍后再看`,
        link: 'https://www.bilibili.com/watchlater#/list',
        item: out,
    };
}
