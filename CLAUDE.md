# RSSHub Route Development Guide

这是 RSSHub 项目的 Claude Code 开发指南，专注于 **Route 开发**。

## 🎯 核心概念

**RSSHub** 是全球最大的 RSS 聚合网络，包含 5000+ 路由处理器，将各种网页内容转换为标准化的 RSS feeds。

- **框架**: Hono (轻量级 Web 框架)
- **语言**: TypeScript (ESNext strict mode)
- **运行时**: Node.js ≥22
- **包管理器**: pnpm (必须, 版本 10.17.1+)
- **架构**: 基于中间件的请求管道 + 动态路由注册

## 🚀 常用命令

```bash
# 开发
pnpm dev                    # 启动开发服务器 (热重载)
pnpm dev:cache              # 生产缓存模式

# 测试
pnpm test                   # 运行所有测试 + 格式检查
pnpm vitest:fullroutes      # 测试所有路由示例

# 代码质量
pnpm format                 # 格式化所有代码 (提交前必须运行!)
pnpm lint                   # 运行 ESLint

# 访问路由
http://localhost:1200/<namespace>/<path>
http://localhost:1200/<namespace>/<path>?limit=10&format=json&debug=1
```

## 📁 Route 文件结构

```
lib/routes/<namespace>/
├── namespace.ts          # 必需: 命名空间元数据
├── index.ts             # 主路由处理器
├── utils.ts             # 可选: 共享工具函数
└── <feature>.ts         # 其他路由处理器
```

## 📝 创建 Route 完整流程

### 步骤 1: 创建 namespace.ts

```typescript
import type { Namespace } from '@/types';

export const namespace: Namespace = {
    name: 'Site Name',              // 英文名
    url: 'example.com',             // 域名 (不含协议)
    description: 'Optional **markdown** description',
    categories: ['traditional-media'],
    lang: 'en',                     // ISO 639-1 语言代码

    // 可选: 中文翻译
    zh: {
        name: '网站中文名',
        description: '可选的中文描述',
    },
};
```

### 步骤 2: 创建路由处理器

```typescript
import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

// 定义数据结构 (必需! 确保类型安全)
interface ArticleItem {
    title: string;
    link: string;
    pubDate?: Date;
    description?: string;
    author?: string;
    category?: string[];
}

export const route: Route = {
    // === 必需字段 ===
    path: '/category/:id',          // Hono 路由模式
    name: 'Category Articles',      // 人类可读的名称
    maintainers: ['your-github-username'],
    handler,                        // 处理函数引用

    // === 强烈推荐 ===
    categories: ['programming'],    // 路由分类
    example: '/site/category/tech', // 必须是可工作的示例!

    // === 参数文档 (如有参数) ===
    parameters: {
        id: 'Category ID',
        state: {
            description: 'Filter state',
            default: 'all',
            options: [              // 可选: 用于 UI 下拉菜单
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
            ],
        },
    },

    // === 功能声明 ===
    features: {
        requireConfig: false,       // 需要 API keys/配置?
        requirePuppeteer: false,    // 需要浏览器自动化?
        antiCrawler: false,         // 有反爬虫措施?
    },
};

// 处理器函数 - 必须是 async
async function handler(ctx) {
    // 1. 获取路由参数
    const id = ctx.req.param('id');
    const limit = ctx.req.query('limit')
        ? Math.min(Number.parseInt(ctx.req.query('limit'), 10), 100)
        : 20;

    // 2. 获取列表页
    const { data: response } = await got({
        method: 'get',
        url: `https://example.com/category/${id}`,
        headers: {
            'User-Agent': 'Mozilla/5.0...',  // 某些站点需要
        },
    });

    // 3. 解析 HTML
    const $ = load(response);
    const list: ArticleItem[] = $('.article-item')
        .toArray()  // 必须使用 .toArray()! (ESLint 规则)
        .slice(0, limit)
        .map((element) => {
            const $item = $(element);
            return {
                title: $item.find('.title').text(),
                link: new URL($item.find('a').attr('href') || '', 'https://example.com').href,
                pubDate: timezone(parseDate($item.find('.date').text()), +8),
            };
        });

    // 4. 获取详情页 (使用缓存!)
    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link, async () => {
                const { data } = await got(item.link);
                const $ = load(data);

                // 移除不需要的元素
                $('.ads').remove();
                $('.comments').remove();

                // 提取内容 (注意空值安全!)
                item.description = $('.content').html() || '';
                item.author = $('.author').text() || '';
                item.category = $('.tag').toArray().map((e) => $(e).text());

                return item;
            })
        )
    );

    // 5. 返回 RSS feed 数据
    return {
        title: `Example - Category ${id}`,
        description: 'Category description',
        link: `https://example.com/category/${id}`,
        item: items,

        // 可选字段
        image: 'https://example.com/logo.png',
        language: 'en',
        allowEmpty: true,   // 允许空 feed (不抛出错误)
    };
}
```

### 路由路径模式 (Hono)

```typescript
path: '/user/:id'                    // 必需参数
path: '/category/:id?'               // 可选参数
path: '/docs/*'                      // 通配符
path: '/post/:id{[0-9]+}'           // 正则表达式

// 访问参数
const id = ctx.req.param('id');          // 路径参数
const limit = ctx.req.query('limit');    // 查询参数 (?limit=10)
```

## 🔄 三种数据获取方法

### 方法 1: API 调用 (推荐 ⭐)

**优先级最高**: 快速、可靠、结构化数据

```typescript
import got from '@/utils/got';        // 推荐 (内部使用 ofetch)
import ofetch from '@/utils/ofetch';  // 也可用

// GET 请求
const { data } = await got({
    url: 'https://api.example.com/posts',
    searchParams: { page: 1, limit: 20 },
    headers: { authorization: `Bearer ${token}` },
});

// POST 请求
const { data } = await got({
    method: 'post',
    url: 'https://api.example.com/data',
    json: { key: 'value' },
});
```

### 方法 2: HTML 解析 (常用)

**无 API 时使用**: Cheerio 解析 HTML

```typescript
import { load } from 'cheerio';

const { data } = await got('https://example.com');
const $ = load(data);

// 选择器
$('.class')                     // class
$('#id')                        // id
$('div > p')                    // CSS 选择器
$('[data-id="123"]')            // 属性

// 获取内容 (注意空值安全!)
const text = $('.content').text();
const html = $('.content').html() || '';         // 提供默认值!
const href = $('a').attr('href') || '';          // 提供默认值!

// 迭代
$('.item').toArray().map((element) => {          // 必须用 .toArray()!
    const $item = $(element);                    // $ 前缀表示 Cheerio 对象
    return {
        title: $item.find('.title').text(),
        link: $item.find('a').attr('href') || '',
    };
});
```

### 方法 3: Puppeteer (最后手段 ⚠️)

**仅当必要时使用**: 慢、资源密集、复杂

**必须在 features 中设置 `requirePuppeteer: true`!**

```typescript
import puppeteer from '@/utils/puppeteer';

export const route: Route = {
    // ...
    features: {
        requirePuppeteer: true,
        antiCrawler: true,
    },
};

async function handler(ctx) {
    const browser = await puppeteer();

    try {
        const page = await browser.newPage();

        // 可选: 屏蔽不必要的资源
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            request.resourceType() === 'image'
                ? request.abort()
                : request.continue();
        });

        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.content');

        const data = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.item')).map((el) => ({
                title: el.querySelector('.title')?.textContent || '',
                link: el.querySelector('a')?.href || '',
            }));
        });

        return { title: 'Feed', item: data };
    } finally {
        await browser.close();  // 必须关闭!
    }
}
```

## 🛠️ 核心工具

```typescript
// HTTP 客户端
import got from '@/utils/got';          // 推荐
import ofetch from '@/utils/ofetch';    // 也可用

// 缓存
import cache from '@/utils/cache';
const data = await cache.tryGet(key, async () => fetchData());

// 日期解析
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

parseDate('2024-01-01T12:00:00Z')           // ISO 8601
parseDate('1704110400', 'X')                // Unix 秒
parseDate('1704110400000', 'x')             // Unix 毫秒
timezone(parseDate('2024-01-01 12:00'), +8) // 应用时区 (源时区!)

// 路径别名 (必须使用!)
import cache from '@/utils/cache';          // ✅ 正确
import cache from '../../utils/cache';      // ❌ 错误

// 相对 URL → 绝对 URL
const link = new URL(relativePath, 'https://example.com').href;
```

## 🎯 最佳实践

### 设计原则 (KISS)

1. **简单至上**: 不要过度设计
   - 90% 用户只用默认设置
   - 3 个 if-else > "灵活配置系统"
   - 删除代码 > 添加代码

2. **优先级**: API > HTML 解析 > Puppeteer

3. **缓存一切**: 详情页必须使用 `cache.tryGet()`

4. **时区处理**: `timezone(date, offset)` 的 offset 是**源时区**，不是目标时区
   ```typescript
   // ✅ 正确: 韩国时间 (UTC+9)
   timezone(parseDate('2025-01-15 14:30'), +9)

   // ❌ 错误: 不要转换成你的本地时区
   timezone(parseDate(koreanTime), +8)  // 错误! 源是 +9
   ```

5. **支持 limit 参数**: 默认 20-50 项
   ```typescript
   const limit = ctx.req.query('limit')
       ? Math.min(Number.parseInt(ctx.req.query('limit'), 10), 100)
       : 20;
   ```

### 类型安全

```typescript
// ✅ 必需: 定义 interface
interface ArticleItem {
    title: string;
    link: string;
    pubDate?: Date;
    description?: string;
}

let items: ArticleItem[] = $('.item').toArray().map((el) => ({
    title: $(el).find('.title').text(),
    link: $(el).find('a').attr('href') || '',  // 提供默认值!
}));
```

### 空值安全

```typescript
// Cheerio 方法可能返回 null/undefined - 必须防护!

// ❌ 危险
item.description += $('.content').html();

// ✅ 安全
item.description += $('.content').html() || '';

// ❌ 危险
const link = $('a').attr('href');

// ✅ 安全
const link = $('a').attr('href') || '';
const link = $('a').attr('href') ?? '';
```

### 变量命名

```typescript
// ✅ Cheerio 对象: 使用 $ 前缀
const $ = load(html);
const $detail = load(detailHTML);
const $item = $(element);

// ✅ DOM 元素迭代
$('.item').toArray().map((element) => {         // 原始 DOM 元素
    const $item = $(element);                   // Cheerio 包装对象
    return { ... };
});

// ❌ 错误: 参数重新赋值
.map((item) => {
    item = $(item);  // 类型混乱!
});
```

## 🔍 ESLint 规则

### 关键规则

```typescript
// ❌ 错误: 直接使用 Cheerio .map()
$('.item').map((index, item) => { ... })

// ✅ 正确: 先转换为数组
$('.item').toArray().map((item) => { ... })

// ❌ 错误: 相对导入
import cache from '../../utils/cache';

// ✅ 正确: 路径别名
import cache from '@/utils/cache';

// ❌ 错误: 参数重新赋值
.map((item) => { item = $(item); })

// ✅ 正确: 新变量
.map((item) => { const $item = $(item); })
```

### 提交前检查

```bash
pnpm format     # 自动修复格式问题
pnpm lint       # 检查剩余错误
```

## 🐛 调试工作流

### 诊断 Route 问题

```bash
# 1. 测试连通性
curl -I "https://example.com"

# 2. 检查 HTML 结构
curl -s "https://example.com" | grep -o 'class="[^"]*"' | sort -u

# 3. 测试选择器
curl -s "https://example.com" | grep -o '<div class="target">' | wc -l

# 4. 添加 User-Agent (常见修复)
curl -s -A "Mozilla/5.0" "https://example.com"

# 5. 测试路由
curl -s "http://localhost:1200/namespace/route?limit=1"

# 6. 验证输出
curl -s "http://localhost:1200/namespace/route?limit=2" | \
  grep -E "<title>|<pubDate>|<link>"
```

### 常见网站变更

| 变更类型 | 示例 | 检测方法 | 修复策略 |
|---------|------|---------|---------|
| **Class 重命名** | `.rank-1` → `.abf-cate` | 旧选择器返回 0 项 | 搜索新 class 名 |
| **结构变更** | `.list` → `.table-row` | 空 feed 或错误 | 检查当前 HTML |
| **API 移除** | JSON → 404 | FetchError 404 | 切换到 HTML 解析 |

## 📋 开发检查清单

**开始前:**
- [ ] 检查网站是否已有 RSS feed
- [ ] 搜索现有类似路由 (`lib/routes/`)
- [ ] 手动测试网站的 API/HTML 结构

**开发中:**
- [ ] 创建 `namespace.ts`
- [ ] 定义 `ArticleItem` interface
- [ ] 选择合适的数据获取方法
- [ ] 详情页使用 `cache.tryGet()`
- [ ] 使用 `timezone()` 处理时区
- [ ] 支持 `limit` 参数

**提交前:**
- [ ] 运行 `pnpm format`
- [ ] 运行 `pnpm lint`
- [ ] 确保 `example` 字段可用
- [ ] 测试边缘情况
- [ ] 所有链接都是绝对 URL
- [ ] 移除敏感数据 (API keys)

## ⚠️ 常见陷阱

```typescript
// 1. ❌ 不使用路径别名
import cache from '../../utils/cache';
// ✅ 使用 @/ 别名
import cache from '@/utils/cache';

// 2. ❌ 不缓存详情获取
await Promise.all(list.map(item => got(item.link)))
// ✅ 使用缓存
await Promise.all(list.map(item => cache.tryGet(item.link, async () => {...})))

// 3. ❌ 硬编码限制
const items = data.slice(0, 10);
// ✅ 可配置限制
const limit = ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit')) : 20;

// 4. ❌ 模糊时区
parseDate('2024-01-01 12:00:00')
// ✅ 明确时区
timezone(parseDate('2024-01-01 12:00:00'), +8)

// 5. ❌ 未声明 Puppeteer
features: { requirePuppeteer: false }  // 但使用了 Puppeteer!
// ✅ 正确声明
features: { requirePuppeteer: true, antiCrawler: true }

// 6. ❌ 返回字符串日期
pubDate: '2024-01-01'
// ✅ 返回 Date 对象
pubDate: parseDate('2024-01-01')
```

## 📊 Route 分类

必须使用以下值之一 (见 `lib/types.ts`):
- `popular`, `social-media`, `new-media`, `traditional-media`
- `bbs`, `blog`, `programming`, `design`, `live`
- `multimedia`, `picture`, `anime`, `program-update`
- `university`, `forecast`, `travel`, `shopping`, `game`
- `reading`, `government`, `study`, `journal`, `finance`, `other`

## 🔧 返回数据格式

### Feed 级别

```typescript
return {
    // 必需
    title: string,              // Feed 标题
    link: string,               // Feed 源 URL
    item: DataItem[],           // Feed 项数组

    // 强烈推荐
    description: string,        // Feed 描述

    // 可选
    image: string,              // Feed 图片 URL
    language: string,           // 语言代码 (如 'en', 'zh-CN')
    allowEmpty: boolean,        // 允许空 feed (默认 false)
    ttl: number,                // 缓存 TTL (秒)
};
```

### Item 级别

```typescript
{
    // 必需
    title: string,              // 项标题

    // 强烈推荐
    link: string,               // 项 URL
    description: string,        // 项内容 (HTML)
    pubDate: Date,              // 发布日期 (必须是 Date 对象!)

    // 推荐
    author: string,             // 作者
    category: string[],         // 标签/分类
    guid: string,               // 唯一标识符

    // 可选
    image: string,              // 项图片/缩略图
    updated: Date,              // 最后更新时间
}
```

## 📚 资源

- **官方文档**: https://docs.rsshub.app/
- **贡献指南**: https://docs.rsshub.app/joinus/
- **路由示例**: 浏览 `lib/routes/` 目录
- **类型定义**: 查看 `lib/types.ts`
- **Hono 文档**: https://hono.dev/
- **Cheerio 文档**: https://cheerio.js.org/

---

**记住**: 简单 > 复杂，删除代码 > 添加代码，实际验证 > 理论分析
