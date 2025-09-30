import type { Namespace } from '@/types';

export const namespace: Namespace = {
    name: 'Al Jazeera',
    url: 'aljazeera.com',
    description: `
Al Jazeera is a Qatari state-owned Arabic-language international news television network.

This route supports multiple language editions:
- **Arabic**: aljazeera.net (الجزيرة)
- **Chinese**: chinese.aljazeera.net (半岛电视台中文网)
- **English**: aljazeera.com

::: tip
You can access different sections and categories by appending paths after the language parameter.
:::
`,
    categories: ['traditional-media'],
    lang: 'en',

    zh: {
        name: '半岛电视台',
        url: 'aljazeera.com',
        description: `
半岛电视台是一家总部位于卡塔尔的国际新闻网络。

此路由支持多语言版本：
- **阿拉伯语**: aljazeera.net (الجزيرة)
- **中文**: chinese.aljazeera.net (半岛电视台中文网)
- **英语**: aljazeera.com
`,
        categories: ['traditional-media'],
        lang: 'zh-CN',
    },
};
