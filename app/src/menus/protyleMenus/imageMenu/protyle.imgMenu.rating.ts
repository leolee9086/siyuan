/** 用途：发送后端请求；使用范围：读取和更新资源评分；解耦评估：请求入口由 imports.ts 统一转发。 */
import { fetchPost } from "./imports";
/** 用途：读取国际化文案；使用范围：清空评分按钮文案；解耦评估：文案来源统一。 */
import { siyuanI18n } from "./imports";

/**
 * 作用：把评分星标节点列表转换为 HTMLElement 数组。
 * 意图：将 DOM 类型收敛在单点处理，避免后续逻辑重复做实例判断。
 * 调用时机：绑定评分事件前。
 * 问题/改进：当前只过滤 HTMLElement，后续可根据组件演进收窄到具体元素类型。
 */
const 收集星标元素 = (ratingContainer: Element) => {
    const starElements: HTMLElement[] = [];
    const rawStars = ratingContainer.querySelectorAll(".star-icon");
    for (const rawStar of rawStars) {
        // querySelectorAll 返回 Element，需要先确认是 HTMLElement 才能安全操作样式与 class。
        if (rawStar instanceof HTMLElement) {
            starElements.push(rawStar);
        }
    }
    return starElements;
};

/**
 * 作用：根据评分值刷新星标样式。
 * 意图：统一维护“高亮/取消高亮”视觉状态，避免在多个事件回调中重复写样式逻辑。
 * 调用时机：初始化读取评分后、设置评分成功后、清空评分成功后。
 * 问题/改进：颜色目前硬编码主题变量，后续可接入主题 token 配置。
 */
const 刷新星标展示 = (starElements: HTMLElement[], rating: number) => {
    for (let index = 0; index < starElements.length; index += 1) {
        const starElement = starElements[index];
        // 评分值以内的星标高亮，评分值以外恢复默认样式。
        if (index < rating) {
            starElement.classList.add("ft__primary");
            starElement.style.color = "var(--b3-theme-primary)";
            continue;
        }
        starElement.classList.remove("ft__primary");
        starElement.style.color = "";
    }
};

/**
 * 作用：处理“读取当前评分”接口响应。
 * 意图：集中管理读取接口的成功分支，避免请求调用处出现复杂回调。
 * 调用时机：`/api/s-forge/asset-meta/get` 返回后。
 * 问题/改进：当前静默忽略失败分支，后续可按产品需求补充提示。
 */
const 处理读取评分响应 = (starElements: HTMLElement[], response: IWebSocketData) => {
    // 仅接口成功且返回数据时刷新评分，避免把异常响应写入 UI。
    if (response.code === 0 && response.data) {
        刷新星标展示(starElements, response.data.star || 0);
    }
};

/**
 * 作用：处理“设置评分/清空评分”接口响应。
 * 意图：复用成功判断和展示刷新逻辑，避免每个请求回调重复样板代码。
 * 调用时机：`/api/s-forge/asset-meta/set` 返回后。
 * 问题/改进：当前仅处理成功响应，后续可追加失败提示。
 */
const 处理设置评分响应 = (starElements: HTMLElement[], rating: number, response: IWebSocketData) => {
    // 仅后端确认写入成功时更新前端展示，避免前后端状态不一致。
    if (response.code === 0) {
        刷新星标展示(starElements, rating);
    }
};

/**
 * 作用：执行评分写入请求。
 * 意图：将 path/star 的请求组装集中在单点，复用到点星与清空动作。
 * 调用时机：星标点击与清空评分按钮点击时。
 * 问题/改进：当前未做节流，后续可按交互需要防抖请求。
 */
const 提交评分 = (src: string, rating: number, starElements: HTMLElement[]) => {
    const requestPayload = {
        path: src,
        star: rating
    };
    const responseHandler = 处理设置评分响应.bind(null, starElements, rating);
    fetchPost("/api/s-forge/asset-meta/set", requestPayload, responseHandler);
};

/**
 * 作用：创建单个星标点击处理器。
 * 意图：把“点击第 N 颗星”语义固化成命名函数，提升事件绑定可读性。
 * 调用时机：循环绑定每个星标的 click 事件时。
 * 问题/改进：当前直接提交请求，后续可在此处接入乐观更新策略。
 */
const 创建星标点击处理器 = (src: string, rating: number, starElements: HTMLElement[]) => {
    return () => {
        提交评分(src, rating, starElements);
    };
};

/**
 * 作用：创建清空评分按钮的点击处理器。
 * 意图：与星标点击处理保持一致的调用链，统一评分提交入口。
 * 调用时机：绑定清空按钮 click 事件时。
 * 问题/改进：当前将清空视为评分 0，后续如需软删除可扩展协议。
 */
const 创建清空评分处理器 = (src: string, starElements: HTMLElement[]) => {
    return () => {
        提交评分(src, 0, starElements);
    };
};

/**
 * 作用：绑定星标点击事件。
 * 意图：把循环绑定逻辑独立，保持主流程函数简洁。
 * 调用时机：评分容器初始化完成后。
 * 问题/改进：目前逐元素绑定，后续可评估事件委托优化。
 */
const 绑定星标点击事件 = (src: string, starElements: HTMLElement[]) => {
    for (let index = 0; index < starElements.length; index += 1) {
        const starElement = starElements[index];
        const clickHandler = 创建星标点击处理器(src, index + 1, starElements);
        starElement.addEventListener("click", clickHandler);
    }
};

/**
 * 作用：绑定清空评分按钮点击事件。
 * 意图：将清空按钮 DOM 判定与事件绑定集中，避免主流程出现额外分支细节。
 * 调用时机：评分容器初始化完成后。
 * 问题/改进：后续若按钮变更为组件化结构，可仅替换该函数实现。
 */
const 绑定清空评分事件 = (ratingContainer: Element, src: string, starElements: HTMLElement[]) => {
    const clearButton = ratingContainer.querySelector("[data-action='clear-rating']");
    // 仅在清空按钮存在时绑定事件，避免不存在节点时报错。
    if (clearButton instanceof HTMLElement) {
        clearButton.addEventListener("click", 创建清空评分处理器(src, starElements));
    }
};

/**
 * 作用：生成评分区域 HTML。
 * 意图：将评分 UI 片段按资源类型条件插入，不影响非 assets 图片菜单。
 * 调用时机：构建图片设置菜单项 label 时。
 * 问题/改进：当前 HTML 字符串较长，后续可替换为模板函数或组件渲染。
 */
/** @同步豁免: UI构建 */
export const genRatingHTML = (src: string) => {
    // 仅 assets 路径显示评分功能，外链图片不参与资源元数据读写。
    if (!src.startsWith("assets/")) {
        return "";
    }
    return `<div class="fn__hr"></div><div class="fn__flex" id="asset-rating-container">
    <span class="fn__flex-center">Rating</span>
    <span class="fn__space"></span>
    <div class="fn__flex fn__flex-1">
        <span class="block__icon block__icon--show b3-tooltips b3-tooltips__e star-icon" style="padding: 4px;" aria-label="1"><svg><use xlink:href="#iconStar"></use></svg></span>
        <span class="block__icon block__icon--show b3-tooltips b3-tooltips__e star-icon" style="padding: 4px;" aria-label="2"><svg><use xlink:href="#iconStar"></use></svg></span>
        <span class="block__icon block__icon--show b3-tooltips b3-tooltips__e star-icon" style="padding: 4px;" aria-label="3"><svg><use xlink:href="#iconStar"></use></svg></span>
        <span class="block__icon block__icon--show b3-tooltips b3-tooltips__e star-icon" style="padding: 4px;" aria-label="4"><svg><use xlink:href="#iconStar"></use></svg></span>
        <span class="block__icon block__icon--show b3-tooltips b3-tooltips__e star-icon" style="padding: 4px;" aria-label="5"><svg><use xlink:href="#iconStar"></use></svg></span>
        <span class="fn__space"></span>
        <span data-action="clear-rating" class="block__icon block__icon--show b3-tooltips b3-tooltips__e" aria-label="${siyuanI18n.clear || "Clear"}"><svg><use xlink:href="#iconTrashcan"></use></svg></span>
    </div>
</div>`;
};

/**
 * 作用：为评分区域绑定初始化与交互事件。
 * 意图：统一处理评分读取、点星写入、清空评分三类事件绑定。
 * 调用时机：图片设置菜单项 bind 阶段，在评分区域插入后调用。
 * 问题/改进：当前未处理事件解绑，后续可结合菜单生命周期补充清理。
 */
/** @同步豁免: 生命周期 */
export const bindRatingEvents = (element: Element, src: string) => {
    // 仅 assets 资源允许绑定评分事件，避免外链触发无效接口请求。
    if (!src.startsWith("assets/")) {
        return;
    }
    const ratingContainer = element.querySelector("#asset-rating-container");
    // 评分容器不存在时直接退出，避免后续查询和绑定空引用。
    if (!ratingContainer) {
        return;
    }
    const starElements = 收集星标元素(ratingContainer);
    fetchPost("/api/s-forge/asset-meta/get", { path: src }, 处理读取评分响应.bind(null, starElements));
    绑定星标点击事件(src, starElements);
    绑定清空评分事件(ratingContainer, src, starElements);
};
