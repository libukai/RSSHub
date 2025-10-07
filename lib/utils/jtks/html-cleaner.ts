/**
 * 今天看啥微信公众号 RSS 处理工具 - HTML 清理引擎
 */

import { load, type CheerioAPI, type Cheerio, type Element } from 'cheerio';
import type { CleanRule } from './types';

/**
 * 根据规则清理 HTML 内容
 * @param html 原始 HTML 字符串
 * @param rules 清理规则数组
 * @returns 清理后的 HTML 字符串
 */
export function cleanHtml(html: string, rules: CleanRule[]): string {
    const $ = load(html);

    for (const rule of rules) {
        applyCleanRule($, rule);
    }

    return $('body').html() || '';
}

/**
 * 应用单条清理规则
 */
function applyCleanRule($: CheerioAPI, rule: CleanRule): void {
    // 1. 选择元素
    let elements = $(rule.selector);

    // 2. 应用过滤条件
    elements = applyFilters($, elements, rule);

    // 3. 执行操作
    executeAction($, elements, rule.action);
}

/**
 * 应用过滤条件 (textMatch 和 attrMatch)
 */
function applyFilters($: CheerioAPI, elements: Cheerio<Element>, rule: CleanRule): Cheerio<Element> {
    // 文本匹配过滤
    if (rule.textMatch) {
        elements = elements.filter((_, elem) => {
            const text = $(elem).text().trim();
            const { type, value } = rule.textMatch!;

            switch (type) {
                case 'startsWith':
                    return text.startsWith(value);
                case 'contains':
                    return text.includes(value);
                case 'equals':
                    return text === value;
                case 'regex':
                    return new RegExp(value).test(text);
                default:
                    return false;
            }
        });
    }

    // 属性匹配过滤
    if (rule.attrMatch) {
        elements = elements.filter((_, elem) => {
            const attrValue = $(elem).attr(rule.attrMatch!.name);
            if (!attrValue) {
                return false;
            }

            const { pattern } = rule.attrMatch!;

            // 支持 ^ 前缀匹配
            if (pattern.startsWith('^')) {
                return attrValue.startsWith(pattern.slice(1));
            }

            // 支持正则匹配
            return new RegExp(pattern).test(attrValue);
        });
    }

    return elements;
}

/**
 * 执行清理操作
 */
function executeAction($: CheerioAPI, elements: Cheerio<Element>, action: CleanRule['action']): void {
    if (elements.length === 0) {
        return;
    }

    switch (action) {
        case 'keep-only':
            // 只保留选中元素，删除其兄弟节点
            elements.siblings().remove();
            break;

        case 'remove':
            // 删除选中元素
            elements.remove();
            break;

        case 'remove-after':
            // 删除选中元素及其之后的所有兄弟节点
            elements.each((_, elem) => {
                $(elem).nextAll().remove();
                $(elem).remove();
            });
            break;

        case 'remove-parent-after':
            // 删除选中元素的父节点及其之后的所有兄弟节点
            elements.each((_, elem) => {
                const parent = $(elem).parent();
                parent.nextAll().remove();
                parent.remove();
            });
            break;

        default:
            // 未知操作类型，不执行任何操作
            break;
    }
}

/**
 * 清理微信公众号通用问题
 * @param html 原始 HTML 字符串
 * @returns 清理后的 HTML 字符串
 */
export function cleanWechatCommonIssues(html: string): string {
    const $ = load(html);

    // 1. 删除追踪像素 (1x1 图片)
    $('img').each((_, elem) => {
        const $img = $(elem);
        const width = $img.attr('width') || $img.css('width');
        const height = $img.attr('height') || $img.css('height');

        if ((width === '1' || width === '1px') && (height === '1' || height === '1px')) {
            $img.remove();
        }
    });

    // 2. 删除隐藏元素
    $('[style*="display:none"]').remove();
    $('[style*="display: none"]').remove();
    $('[style*="visibility:hidden"]').remove();
    $('[style*="visibility: hidden"]').remove();

    // 3. 删除空段落和空 div
    $('p:empty, div:empty').remove();

    // 4. 删除 iframe, script, style 标签
    $('iframe, script, style').remove();

    // 5. 删除微信集成组件
    $('[class*="js_wx_"]').remove();

    return $('body').html() || '';
}

/**
 * 组合清理函数: 先应用自定义规则,再应用通用清理
 * @param html 原始 HTML 字符串
 * @param rules 自定义清理规则
 * @returns 清理后的 HTML 字符串
 */
export function cleanWechatHtml(html: string, rules: CleanRule[]): string {
    // 先应用自定义规则 (保留 js_content 等主要内容)
    let cleaned = cleanHtml(html, rules);

    // 再应用通用清理 (删除追踪元素等)
    cleaned = cleanWechatCommonIssues(cleaned);

    return cleaned;
}
