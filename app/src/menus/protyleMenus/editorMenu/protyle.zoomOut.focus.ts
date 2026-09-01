/**
 * 用途：发起补偿加载请求。
 * 使用范围：focusId 未命中后的补偿分支。
 * 解耦评估：统一请求入口，便于替换网络层实现。
 */
import { fetchPost } from "./imports";
/**
 * 用途：把补偿响应应用到 protyle。
 * 使用范围：根文档补偿与目标块补偿回调。
 * 解耦评估：渲染入口保持统一，避免重复处理逻辑。
 */
import { onGet } from "./imports";
/**
 * 用途：聚焦块元素。
 * 使用范围：恢复焦点到命中的目标元素或其可见替代元素。
 * 解耦评估：焦点细节由工具层处理，业务层只负责流程编排。
 */
import { focusBlock } from "./imports";
/**
 * 用途：获取首个可显示块。
 * 使用范围：目标节点位于容器节点时的聚焦兜底。
 * 解耦评估：块结构解析集中在工具层，避免业务硬编码节点规则。
 */
import { getFirstBlock } from "./imports";
/**
 * 用途：同步查询 unfolded parent。
 * 使用范围：focusId 节点未渲染时补偿查询。
 * 解耦评估：遗留同步接口，后续可替换为异步协议。
 */
import { fetchSyncPost } from "./imports";
/**
 * 用途：读取运行时配置。
 * 使用范围：补偿请求 `size` 参数。
 * 解耦评估：通过环境封装隔离全局对象访问。
 */
import { getSiyuanConfig } from "./imports";
/**
 * 用途：读取流程常量。
 * 使用范围：构造补偿 onGet 动作集合。
 * 解耦评估：常量集中维护，避免散落魔法值。
 */
import { Constants } from "./imports";
/**
 * 用途：约束 zoomOut 入参结构。
 * 使用范围：焦点恢复子模块函数签名。
 * 解耦评估：类型定义独立在 *.types.ts，遵守架构约束。
 */
import type { ZoomOutOptions } from "./protyle.zoomOut.types";
/** 用途：统一构造加密感知的 getDoc 参数。使用范围：两条焦点补偿加载。解耦评估：同目录请求 helper。 */
import { createZoomOutGetDocParams } from "./protyle.zoomOut.request";

const FOCUS_ACTION_PUSH = [Constants.CB_GET_FOCUS];
const FOCUS_ACTION_NO_PUSH = [Constants.CB_GET_FOCUS, Constants.CB_GET_UNUNDO];

/**
 * 作用：计算补偿加载的 onGet 动作。
 * 意图：保持 pushBack 与非 pushBack 历史行为一致。
 * 调用时机：补偿请求回调执行时。
 * 问题/改进：动作映射仍是静态常量，后续可抽象为策略层。
 */
const 获取聚焦补偿动作 = (options: ZoomOutOptions) => {
    if (options.isPushBack) {
        return FOCUS_ACTION_PUSH;
    }
    return FOCUS_ACTION_NO_PUSH;
};

/**
 * 作用：根据 focusId 查找目标元素，必要时回退查询 parent。
 * 意图：处理目标块尚未渲染的场景。
 * 调用时机：主文档响应后执行焦点恢复。
 * 问题/改进：当前使用同步请求，后续可改异步并减少阻塞。
 */
const 获取焦点目标元素 = async (options: ZoomOutOptions) => {
    if (!options.focusId) {
        return null;
    }

    let focusElement = options.protyle.wysiwyg.element.querySelector(`[data-node-id="${options.focusId}"]`);
    if (focusElement) {
        return focusElement;
    }

    const unfoldResponse = await fetchSyncPost("/api/block/getUnfoldedParentID", { id: options.focusId });
    options.focusId = unfoldResponse.data.parentID;
    if (!options.focusId) {
        return null;
    }

    focusElement = options.protyle.wysiwyg.element.querySelector(`[data-node-id="${options.focusId}"]`);
    return focusElement;
};

/**
 * 作用：把目标元素映射为可见、可聚焦的最终元素。
 * 意图：兼容折叠块或隐藏容器导致的不可见节点。
 * 调用时机：焦点恢复命中目标元素后。
 * 问题/改进：依赖 DOM 结构推断，可考虑由渲染层提供可见节点 API。
 */
const 获取可见聚焦元素 = (focusElement: Element) => {
    let showElement = focusElement;
    while (showElement.getBoundingClientRect().height === 0 && showElement.parentElement) {
        showElement = showElement.parentElement;
    }

    if (!showElement.classList.contains("protyle-wysiwyg")) {
        return getFirstBlock(showElement);
    }

    const siblingElement = focusElement.previousElementSibling || focusElement.nextElementSibling;
    if (siblingElement) {
        return siblingElement;
    }
    return focusElement;
};

/**
 * 作用：聚焦目标块。
 * 意图：焦点滚动交给 onGet 的 scrollAttr/scrollPosition 统一处理。
 * 调用时机：命中目标元素后立即执行。
 * 问题/改进：依赖 DOM 结构推断，可考虑由渲染层提供可见节点 API。
 */
const 聚焦到目标 = (focusElement: Element) => {
    const showElement = 获取可见聚焦元素(focusElement);
    focusBlock(showElement);
};

/**
 * 作用：创建补偿请求回调。
 * 意图：避免 fetchPost 现场定义长回调，保持调用点简洁。
 * 调用时机：发起根文档或目标块补偿请求时。
 * 问题/改进：响应类型仍偏宽，可进一步细化。
 */
const 创建聚焦补偿回调 = (options: ZoomOutOptions) => {
    return (getFocusResponse: IWebSocketData) => {
        onGet({
            data: getFocusResponse,
            protyle: options.protyle,
            action: 获取聚焦补偿动作(options),
            scrollAttr: options.focusId ? {
                rootId: options.id,
                focusId: options.focusId,
            } : undefined,
            dataDocType: options.dataDocType,
        });
    };
};

/**
 * 作用：处理 zoomOut 的焦点恢复与补偿加载。
 * 意图：把复杂焦点逻辑从主流程拆分出来，按关注点独立维护。
 * 调用时机：主文档 onGet 之后。
 * 问题/改进：补偿路径较多，后续可继续收敛为状态机。
 */
export const 处理ZoomOut焦点恢复 = async (options: ZoomOutOptions) => {
    if (!options.focusId) {
        return false;
    }

    const focusElement = await 获取焦点目标元素(options);
    if (focusElement) {
        聚焦到目标(focusElement);
        return false;
    }

    if (!options.focusId) {
        fetchPost(
            "/api/filetree/getDoc",
            createZoomOutGetDocParams(options, {
                id: options.protyle.block.rootID,
                size: getSiyuanConfig().editor.dynamicLoadBlocks,
            }),
            创建聚焦补偿回调(options)
        );
        return true;
    }

    if (options.id !== options.protyle.block.rootID) {
        return false;
    }

    fetchPost(
        "/api/filetree/getDoc",
        createZoomOutGetDocParams(options, {
            id: options.focusId,
            mode: 3,
            size: getSiyuanConfig().editor.dynamicLoadBlocks,
        }),
        创建聚焦补偿回调(options)
    );
    return true;
};
