/** 用途：集中取得布局重排所需的模型查询、编辑器清理、PDF重排和持久化能力；使用范围：本文件的单次重排流程；解耦评估：这些行为由已有子域提供，当前调用需要保持原有顺序，参数化会复制布局语义，故通过本地 imports 网关直达唯一实现。 */
import {getAllModels} from "./imports";
/** 用途：读取布局重排防抖状态；使用范围：本文件的调度入口；解耦评估：状态由 SForge 注册表统一管理，不能通过局部闭包替代，否则跨调用方会产生多个计时器。 */
import {getSForgeState} from "./imports";
/** 用途：清理全部编辑器浮层；使用范围：重排收尾；解耦评估：沿用既有 Protyle 唯一实现，避免复制 UI 清理逻辑。 */
import {hideAllElements} from "./imports";
/** 用途：清理单个回链编辑器浮层；使用范围：回链模型重排；解耦评估：沿用既有 Protyle 唯一实现，调用参数已足够表达边界。 */
import {hideElements} from "./imports";
/** 用途：定位布局重排状态注册表；使用范围：统一状态读写；解耦评估：Symbol 仅提供不可变身份，不引入具体布局类。 */
import {LAYOUT_RESIZE_REGISTRY} from "./imports";
/** 用途：执行 PDF 视图重排；使用范围：所有布局重排收尾；解耦评估：PDF 组件保留自身算法，直接复用实现比参数化复制更稳定。 */
import {pdfResize} from "./imports";
/** 用途：保存布局重排结果；使用范围：调用方要求保存时的收尾；解耦评估：持久化语义由布局子域唯一实现，当前只传递既有调用意图。 */
import {saveLayout} from "./imports";
/** 用途：写入布局重排防抖状态；使用范围：调度入口初始化注册表；解耦评估：与读取能力成对使用，统一写入同一全局注册表。 */
import {setSForgeState} from "./imports";

/** 读取或初始化全部调用方共享的布局重排调度状态。 */
const getLayoutResizeState = () => {
    let state = getSForgeState(LAYOUT_RESIZE_REGISTRY);
    if (!state) {
        state = {};
        setSForgeState(LAYOUT_RESIZE_REGISTRY, state);
    }
    return state;
};

/** 执行一次完整布局重排；由统一防抖计时器调用，以合并多个布局变更事件。 */
const runResize = (isSaveLayout: boolean) => {
    const models = getAllModels();
    for (const item of models.editor) {
        // 只重排已挂载且可见的编辑器，避免对未完成初始化或隐藏页签触发 DOM 计算。
        if (item.editor?.protyle && item.element.parentElement && !item.element.classList.contains("fn__none")) {
            item.editor.resize();
        }
    }
    for (const item of models.backlink) {
        const mTreeElement = item.element.querySelector<HTMLElement>(".backlinkMList");
        const previousElement = mTreeElement?.previousElementSibling;
        // 只有树面板有实际高度且存在标题兄弟节点时才重算可滚动区域。
        if (mTreeElement?.style.height && mTreeElement.style.height !== "0px" && item.element.clientHeight !== 0 && previousElement) {
            mTreeElement.style.height = `${item.element.clientHeight - previousElement.clientHeight * 2}px`;
        }
        for (const editorItem of item.editors) {
            hideElements(["gutter"], editorItem.protyle);
            editorItem.resize();
        }
    }
    for (const item of models.search) {
        const searchUnRefPanel = item.element.querySelector("#searchUnRefPanel");
        // 搜索页根据引用结果面板的可见状态选择对应编辑器。
        if (!searchUnRefPanel || searchUnRefPanel.classList.contains("fn__none")) {
            item.editors.edit.resize();
            continue;
        }
        item.editors.unRefEdit.resize();
    }
    for (const item of models.custom) {
        if (item.resize) {
            item.resize();
        }
    }
    pdfResize();
    hideAllElements(["gutter"]);
    if (isSaveLayout) {
        saveLayout();
    }
};

/** 在布局过渡结束后重排全部可见模型，并按调用语义保存布局。
 * @同步豁免: 生命周期 - 调用返回前必须同步取消上一调度并登记新的唯一计时器，异步包装会暴露竞态窗口。
 */
export const resizeTabs = (isSaveLayout = true) => {
    const state = getLayoutResizeState();
    window.clearTimeout(state.timeout);
    // .layout .fn__flex-shrink 的 150ms 过渡结束后再计算，保留原 200ms 防抖窗口。
    // 这里不能使用单个 transitionend：一次布局操作可能触发多个元素、多个事件，且调用方需要共享防抖语义；200ms 来自现有 150ms CSS 过渡并留出收尾余量。
    state.timeout = window.setTimeout(() => runResize(isSaveLayout), 200);
};
