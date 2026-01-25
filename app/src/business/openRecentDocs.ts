import {fetchPost} from "../util/fetch";
import {Dialog} from "../dialog";
import {Constants} from "../constants";
import {focusByRange} from "../protyle/util/selection";
import {hideElements} from "../protyle/ui/hideElements";
import {setStorageVal} from "../protyle/util/compatibility";
import {createVueComponentInDialog, VueComponentMountConfig} from "../util/vue/mount";
import RecentDocs from "../components/recentDocsAndDocks.vue";
import {siyuanI18n} from "../util/siyuanEnvironments/i18n.getI18n.environment";
import {getSiyuanDialogs} from "../util/siyuanEnvironments/getDialog.environment";
import {getSiyuanStorage} from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import {IRecentDoc} from "./openRecentDocs.types";
import {isHTMLSelectElement, isTRecentDocsSort} from "./openRecentDocs.guard";

/**
 * 处理文档选择事件
 * 作用: 打开选中的文档
 * 意图: 响应用户在最近文档对话框中选择文档的操作
 * 调用时机: 用户点击最近文档列表中的某个文档时
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
 */
const createRecentDocsVueConfig = (
    recentDocs: IRecentDoc[],
    sortBy: string,
    onSortChange: (newSortBy: string) => void
): VueComponentMountConfig => {
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
 * @同步豁免: 必须同步
 * 原因: 此函数需要立即检查对话框状态并决定是否显示,不能异步执行
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
