/** 用途：HTTP POST 请求工具。使用范围：调用后端 API 获取最近文档数据。解耦评估：通过 imports.ts 转发。 */
import {fetchPost} from "./imports";
/** 用途：Dialog 对话框组件。使用范围：创建最近文档对话框。解耦评估：通过 imports.ts 转发。 */
import {Dialog} from "./imports";
/** 用途：应用常量定义。使用范围：使用 DIALOG_RECENTDOCS、LOCAL_RECENT_DOCS 等常量。解耦评估：通过 imports.ts 转发。 */
import {Constants} from "./imports";
/** 用途：通过 Range 恢复编辑器焦点。使用范围：对话框关闭后恢复光标位置。解耦评估：通过 imports.ts 转发。 */
import {focusByRange} from "./imports";
/** 用途：隐藏指定类型的 UI 元素。使用范围：关闭已打开的对话框。解耦评估：通过 imports.ts 转发。 */
import {hideElements} from "./imports";
/** 用途：本地存储值写入工具。使用范围：保存排序方式配置。解耦评估：通过 imports.ts 转发。 */
import {setStorageVal} from "./imports";
/** 用途：Vue 组件在对话框中挂载的工具函数。使用范围：创建 Vue 驱动的对话框内容。解耦评估：通过 imports.ts 转发。 */
import {createVueComponentInDialog} from "./imports";
/** 用途：最近文档 Vue 组件。使用范围：渲染最近文档列表界面。解耦评估：通过 imports.ts 转发。 */
import {RecentDocs} from "./imports";
/** 用途：国际化文案。使用范围：获取对话框标题等文案。解耦评估：通过 imports.ts 转发。 */
import {siyuanI18n} from "./imports";
/** 用途：获取全局对话框集合。使用范围：查找和管理最近文档对话框实例。解耦评估：通过 imports.ts 转发。 */
import {getSiyuanDialogs} from "./imports";
/** 用途：获取 SiYuan 全局存储。使用范围：读取最近文档排序配置。解耦评估：通过 imports.ts 转发。 */
import {getSiyuanStorage} from "./imports";
/** 用途：最近文档数据类型定义。使用范围：openRecentDocs 模块处理最近文档数据。解耦评估：类型定义通过同目录文件导入，避免跨目录依赖。 */
import {IRecentDoc} from "./openRecentDocs.types";
/** 用途：HTMLSelectElement 类型守卫。使用范围：openRecentDocs 模块安全操作排序选择器。解耦评估：类型守卫通过同目录文件导入，避免跨目录依赖。 */
import {isHTMLSelectElement} from "./openRecentDocs.guard";
/** 用途：排序类型守卫。使用范围：openRecentDocs 模块校验排序方式有效性。解耦评估：类型守卫通过同目录文件导入，避免跨目录依赖。 */
import {isTRecentDocsSort} from "./openRecentDocs.guard";

/**
 * 处理文档选择事件
 * 作用: 打开选中的文档
 * 意图: 响应用户在最近文档对话框中选择文档的操作
 * 调用时机: 用户点击最近文档列表中的某个文档时
 * @柯里化: 闭包捕获 doc 上下文，作为事件处理器传递给 Vue 组件
 */
const handleDocSelected = (doc: IRecentDoc) => {
    fetchPost("/api/filetree/openDoc", {
        id: doc.rootID,
        action: [0, 1]
    });
};

/**
 * 创建最近文档Vue应用配置
 * 作用: 配置Vue组件的数据和事件处理器
 * 意图: 为Vue组件提供必要的props和事件处理
 * 调用时机: 创建最近文档对话框时
 * @param recentDocs 最近文档数据
 * @param sortBy 排序方式
 * @param onSortChange 排序变更回调
 * @显式返回类型原因: VueComponentMountConfig 类型需要明确约束返回对象结构，确保与 createVueComponentInDialog 的参数类型匹配
 */
const createRecentDocsVueConfig = (
    recentDocs: IRecentDoc[],
    sortBy: string,
    onSortChange: (newSortBy: string) => void
) => {
    return {
        components: {
            RecentDocs
        },
        data: {
            recentDocs,
            sortBy
        },
        eventHandlers: {
            handleDocSelected,
            onSortChange
        },
        template: "<RecentDocs :recent-docs=\"recentDocs\" :sort-by=\"sortBy\" @doc-selected=\"handleDocSelected\" @sort-change=\"onSortChange\" ref=\"recentDocsComponent\" />",
        initMethodName: "focusSearchInput"
    };
};

/**
 * 处理排序变更
 * 作用: 当用户更改排序方式时,重新获取并显示排序后的数据
 * 意图: 提供动态排序功能,无需关闭对话框即可切换排序方式
 * 调用时机: 用户在排序下拉框中选择新的排序方式时
 * @param newSortBy 新的排序方式
 */
const handleSortChange = (newSortBy: string) => {
    const storage = getSiyuanStorage();
    const recentDocsStorage = storage[Constants.LOCAL_RECENT_DOCS];
    
    // 保存新的排序方式
    recentDocsStorage.type = newSortBy;
    setStorageVal(Constants.LOCAL_RECENT_DOCS, recentDocsStorage);

    // @内联回调
    // 重新获取排序后的数据
    fetchPost("/api/storage/getRecentDocs", {sortBy: newSortBy}, (newResponse) => {
        // 关闭当前对话框
        const dialogs = getSiyuanDialogs();
        const currentDialog = dialogs.find(item =>
            item.element.getAttribute("data-key") === Constants.DIALOG_RECENTDOCS
        );
        if (currentDialog) {
            currentDialog.destroy();
        }

        // 创建新对话框显示排序后的数据
        createRecentDocsDialog(newResponse.data, newSortBy);
    });
};

/**
 * 创建最近文档对话框
 * 作用: 创建并配置最近文档对话框UI
 * 意图: 提供用户界面来浏览和选择最近访问的文档,支持排序功能
 * 调用时机: 用户触发打开最近文档功能时
 * @param recentDocs 最近文档数据
 * @param sortBy 当前排序方式
 */
const createRecentDocsDialog = (
    recentDocs: IRecentDoc[],
    sortBy: string
) => {
    let range: Range;
    const selection = getSelection();
    // @无需注释
    if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
    }

    const dialog = new Dialog({
        positionId: Constants.DIALOG_RECENTDOCS,
        title: `<div class="fn__flex">
<div class="fn__flex-center">${siyuanI18n.recentDocs}</div>
<div class="fn__flex-1"></div>
<div class="fn__flex-center">
    <select class="b3-select" id="recentDocsSort">
        <option value="viewedAt">${siyuanI18n.recentViewed}</option>
        <!-- 上游合并：新增按创建时间排序选项 -->
        <option value="created">${siyuanI18n.recentCreated}</option>
        <option value="updated">${siyuanI18n.recentModified}</option>
        <option value="openAt">${siyuanI18n.recentOpened}</option>
        <option value="closedAt">${siyuanI18n.recentClosed}</option>
    </select>
</div>
</div>`,
        content: "",
        height: "80vh",
        /**
         * 对话框销毁回调
         * 作用: 在对话框关闭时恢复之前的光标位置
         * 意图: 提供更好的用户体验,关闭对话框后光标回到原位置
         * 调用时机: 对话框被销毁时
         */
        destroyCallback: () => {
            // @无需注释
            if (range && range.getBoundingClientRect().height !== 0) {
                focusByRange(range);
            }
        }
    });

    // 设置排序选择器的值
    const sortSelectElement = dialog.element.querySelector("#recentDocsSort");
    // @无需注释
    if (isHTMLSelectElement(sortSelectElement)) {
        sortSelectElement.value = sortBy;
        // 添加排序变更事件监听
        sortSelectElement.addEventListener("change", () => {
            handleSortChange(sortSelectElement.value);
        });
    }

    // 使用通用Vue组件加载器创建并挂载Vue应用到对话框内容区域
    createVueComponentInDialog(dialog, createRecentDocsVueConfig(recentDocs, sortBy, handleSortChange));
    dialog.element.setAttribute("data-key", Constants.DIALOG_RECENTDOCS);

    return dialog;
};

/**
 * 打开最近文档对话框
 * 作用: 显示最近访问的文档列表,支持搜索和排序
 * 意图: 提供快速访问最近文档的功能
 * 调用时机: 用户通过快捷键或菜单触发打开最近文档功能时
 *
 * @同步豁免: 需要绝对同步的DOM访问
 * 原因: 此函数需要立即检查对话框状态并决定是否显示,涉及DOM元素属性读取和UI状态切换,必须同步执行以避免竞态条件
 */
export const openRecentDocs = () => {
    const dialogs = getSiyuanDialogs();
    const openRecentDocsDialog = dialogs.find(item => {
        if (item.element.getAttribute("data-key") === Constants.DIALOG_RECENTDOCS) {
            return true;
        }
    });
    if (openRecentDocsDialog) {
        hideElements(["dialog"]);
        return;
    }

    // 获取当前排序方式
    const storage = getSiyuanStorage();
    const recentDocsStorage = storage[Constants.LOCAL_RECENT_DOCS];
    const sortByValue = recentDocsStorage.type;
    
    // 使用类型守卫确保sortBy是有效的排序类型,否则使用默认值
    const sortBy: TRecentDocsSort = isTRecentDocsSort(sortByValue) ? sortByValue : "viewedAt";

    // 获取最近文档数据
    fetchPost("/api/storage/getRecentDocs", {sortBy}, (response) => {
        createRecentDocsDialog(response.data, sortBy);
    });
};
