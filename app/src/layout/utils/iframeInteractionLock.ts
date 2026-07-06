/** 拖拽期间加在 body 上的 CSS 类名，用于屏蔽 iframe 等嵌套元素拦截鼠标事件 */
export const IFRAME_INTERACTION_LOCK_CLASS = "layout--iframe-interaction-lock";

const LOCK_COUNT_ATTR = "data-iframe-interaction-lock-count";

/**
 * 获取 document.body，在非浏览器环境（如 SSR 或 document 未定义时）返回 null。
 *
 * - 作用：安全地读取当前文档的 body 元素。
 * - 意图：集中封装 document.body 访问，避免各处重复判断 document 是否存在。
 * - 调用时机：acquireIframeInteractionLock / releaseIframeInteractionLock 内部调用。
 * - 问题/改进：仅做 null 防御，不处理 body 尚未渲染完成的情况，调用方需自行判空。
 *
 * @同步豁免: 需要绝对同步的DOM访问 - 拖拽事件处理链中必须同步读取 body 以立即增减锁计数
 */
const getBody = () => {
    if (typeof document === "undefined") {
        return null;
    }
    return document.body;
};

/**
 * 从 body 元素的 data-iframe-interaction-lock-count 属性中读取当前锁计数。
 *
 * - 作用：解析并校验锁计数属性，返回非负整数。
 * - 意图：将字符串形式的计数安全转换为数字，避免非法值污染后续的加减运算。
 * - 调用时机：acquireIframeInteractionLock / releaseIframeInteractionLock 在加减计数前调用。
 * - 问题/改进：属性缺失或非法时回退为 0，保证异常状态下锁可被重置。
 *
 * @param bodyElement 当前文档的 body 元素
 * @同步豁免: 需要绝对同步的DOM访问 - 拖拽事件处理链中必须同步读取计数以正确叠加锁
 */
const readLockCount = (bodyElement: HTMLElement) => {
    const rawCount = bodyElement.getAttribute(LOCK_COUNT_ATTR) || "0";
    const parsedCount = Number.parseInt(rawCount, 10);
    if (!Number.isFinite(parsedCount) || parsedCount < 0) {
        return 0;
    }
    return parsedCount;
};

/**
 * 将锁计数写回 body 元素，并同步增删交互锁定 CSS 类。
 *
 * - 作用：根据计数正负设置或清除 data-iframe-interaction-lock-count 属性与锁定类名。
 * - 意图：通过引用计数支持多个拖拽源并发加锁，仅当计数归零时才真正解除锁定。
 * - 调用时机：acquireIframeInteractionLock / releaseIframeInteractionLock 在计算出新计数后调用。
 * - 问题/改进：计数为 0 时移除属性与类名，避免遗留空属性影响 DOM 状态。
 *
 * @param bodyElement 当前文档的 body 元素
 * @param count 新的锁计数值
 * @同步豁免: 需要绝对同步的DOM访问 - 必须在当前事件循环内完成 DOM 类名切换，否则拖拽期间 iframe 仍会拦截事件
 */
const writeLockCount = (bodyElement: HTMLElement, count: number) => {
    // 计数归零时清理属性与类名，恢复 iframe 正常交互
    if (count <= 0) {
        bodyElement.removeAttribute(LOCK_COUNT_ATTR);
        bodyElement.classList.remove(IFRAME_INTERACTION_LOCK_CLASS);
        return;
    }
    bodyElement.setAttribute(LOCK_COUNT_ATTR, count.toString());
    bodyElement.classList.add(IFRAME_INTERACTION_LOCK_CLASS);
};

/**
 * 获取 iframe 交互锁，在拖拽开始时调用以屏蔽 iframe 拦截鼠标事件。
 *
 * - 作用：将 body 上的锁计数加 1，并添加 layout--iframe-interaction-lock 类名。
 * - 意图：拖拽页签或调整布局大小时，iframe 会吞掉 mousemove 事件导致拖拽中断，加锁可临时禁用其指针事件。
 * - 调用时机：Tab 拖拽 dragstart、addResize 拖拽按下等场景的起始处调用。
 * - 问题/改进：使用引用计数支持嵌套加锁，调用方必须配对调用 releaseIframeInteractionLock 以避免锁泄漏。
 *
 * @同步豁免: 需要绝对同步的DOM访问 - 拖拽起始事件中必须同步加锁，否则首个 mousemove 即被 iframe 拦截
 */
export const acquireIframeInteractionLock = () => {
    const bodyElement = getBody();
    if (!bodyElement) {
        return;
    }
    writeLockCount(bodyElement, readLockCount(bodyElement) + 1);
};

/**
 * 释放 iframe 交互锁，在拖拽结束时调用以恢复 iframe 正常交互。
 *
 * - 作用：将 body 上的锁计数减 1，计数归零时移除 layout--iframe-interaction-lock 类名。
 * - 意图：与 acquireIframeInteractionLock 配对，确保拖拽结束后 iframe 重新可交互。
 * - 调用时机：Tab 拖拽 dragend、addResize 拖拽 mouseup 等场景的结束处调用。
 * - 问题/改进：计数不会低于 0，但调用方必须保证每次 acquire 都有对应 release，否则锁永不解除。
 *
 * @同步豁免: 需要绝对同步的DOM访问 - 拖拽结束事件中必须同步解锁，否则 iframe 将持续处于不可交互状态
 */
export const releaseIframeInteractionLock = () => {
    const bodyElement = getBody();
    if (!bodyElement) {
        return;
    }
    writeLockCount(bodyElement, readLockCount(bodyElement) - 1);
};
