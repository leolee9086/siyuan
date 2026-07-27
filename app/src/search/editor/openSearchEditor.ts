/** 用途：搜索结果编辑器导航所需能力；使用范围：范围保存与打开目标；解耦评估：经本域网关直达真实所有者。 */
import {checkFold} from "./imports";
/** 用途：选择搜索导航动作和存储键；使用范围：范围恢复与打开目标；解耦评估：稳定枚举值经本域网关集中暴露。 */
import {Constants} from "./imports";
/** 用途：取得范围块的可编辑根；使用范围：仅用于计算选区偏移；解耦评估：DOM 算法是搜索编辑器的必要外部能力，经网关可在测试中替换。 */
import {getContenteditableElement} from "./imports";
/** 用途：计算当前搜索范围偏移；使用范围：仅用于保存文件位置；解耦评估：选区算法经网关隔离，操作对象无需携带算法实现。 */
import {getSelectionOffset} from "./imports";
/** 用途：取得已初始化的应用存储；使用范围：仅写入当前文件位置；解耦评估：环境边界经严格访问器和网关集中，不向调用方泄漏全局状态。 */
import {getSiyuanStorage} from "./imports";
/** 用途：定位范围所属块；使用范围：仅处理当前搜索命中；解耦评估：DOM 定位算法经网关隔离，测试可确定性替换。 */
import {hasClosestBlock} from "./imports";
/** 用途：约束打开搜索结果的完整操作数据；使用范围：搜索列表和键盘导航；解耦评估：纯类型直达本子域声明，不产生运行时依赖。 */
import type {OpenSearchEditorOptions} from "./openSearchEditor.types";

/** 读取预览编辑器必须初始化的正文容器。 */
const getRequiredContentElement = (protyle: IProtyle) => {
    if (!protyle.contentElement) {
        throw new TypeError("Search preview Protyle is missing contentElement");
    }
    return protyle.contentElement;
};

/** 保存当前搜索范围，并返回打开目标时是否需要恢复该范围。 */
const preserveSearchRange = (options: {
    protyle: IProtyle;
    id: string;
    rootId: string;
}) => {
    let currentRange = options.rootId === options.protyle.block.rootID && options.id === options.protyle.block.id ?
        options.protyle.highlight.ranges[options.protyle.highlight.rangeIndex] : null;
    if (options.protyle.block.scroll || !currentRange) {
        return {id: options.id, currentRange: null};
    }
    const rangeBlockElement = hasClosestBlock(currentRange.startContainer);
    if (!rangeBlockElement) {
        return {id: options.id, currentRange};
    }
    const id = rangeBlockElement.getAttribute("data-node-id");
    if (!id) {
        throw new TypeError("Search range block is missing data-node-id");
    }
    const offset = getSelectionOffset(getContenteditableElement(rangeBlockElement) || rangeBlockElement,
        undefined, options.protyle.highlight.ranges[options.protyle.highlight.rangeIndex]);
    const rootId = options.protyle.block.rootID;
    if (!rootId) {
        throw new TypeError("Search preview Protyle is missing rootID");
    }
    const storage = getSiyuanStorage();
    const filePositions = storage[Constants.LOCAL_FILEPOSITION];
    filePositions[rootId] = {
        rootId,
        focusId: id,
        focusStart: offset.start,
        focusEnd: offset.end,
        zoomInId: options.protyle.block.showAll ? options.protyle.block.id : undefined,
        scrollTop: getRequiredContentElement(options.protyle).scrollTop,
    };
    // 折叠选区只保存光标位置，重新打开时不需要走搜索范围恢复动作。
    if (offset.start === offset.end) {
        currentRange = null;
    }
    return {id, currentRange};
};

/** 为本次导航创建独立动作数组。 */
const getSearchNavigationAction = (currentRange: Range | null, zoomIn: boolean) => {
    const action: TProtyleAction[] = [
        Constants.CB_GET_FOCUS,
        zoomIn ? Constants.CB_GET_ALL : Constants.CB_GET_CONTEXT,
    ];
    // 有有效搜索范围时恢复滚动和搜索标记，否则只高亮目标块。
    if (currentRange) {
        action.push(Constants.CB_GET_SCROLL, Constants.CB_GET_SEARCH);
        return action;
    }
    action.push(Constants.CB_GET_HL);
    return action;
};

/** 在折叠状态确定后执行导航，并保持既有回调顺序。 */
const openPreservedSearch = (
    options: OpenSearchEditorOptions,
    preserved: ReturnType<typeof preserveSearchRange>,
    zoomIn: boolean,
) => {
    options.protyle.app.openBlock({
        id: preserved.id,
        action: getSearchNavigationAction(preserved.currentRange, zoomIn),
        zoomIn,
        position: options.openPosition,
        scrollPosition: "center",
    });
    options.cb?.();
};

/** 在当前搜索预览对应的应用宿主中打开结果编辑器。 */
/** @同步豁免: UI构建 - 点击和键盘调用依赖当前事件栈立即启动折叠检查与导航回调。 */
export const openSearchEditor = (options: OpenSearchEditorOptions) => {
    const preserved = preserveSearchRange(options);
    options.id = preserved.id;
    checkFold(options.id, zoomIn => openPreservedSearch(options, preserved, zoomIn));
};
