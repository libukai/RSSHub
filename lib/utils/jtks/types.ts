/**
 * 今天看啥微信公众号 RSS 处理工具 - 类型定义
 */

/**
 * 清理规则接口
 */
export interface CleanRule {
    description: string; // 规则描述
    selector: string; // CSS 选择器
    action: 'keep-only' | 'remove' | 'remove-after' | 'remove-parent-after'; // 操作类型
    textMatch?: {
        type: 'startsWith' | 'contains' | 'equals' | 'regex';
        value: string;
    };
    attrMatch?: {
        name: string; // 属性名
        pattern: string; // 匹配模式 (支持 ^ 前缀匹配)
    };
}

/**
 * 微信公众号源配置接口
 */
export interface WechatSourceConfig {
    name: string; // 路由名称 (如 'huxiu')
    displayName: string; // 显示名称
    rssUrl: string; // 今天看啥 RSS URL
    cleanRules: CleanRule[]; // HTML 清理规则
}
