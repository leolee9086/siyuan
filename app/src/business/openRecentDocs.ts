import {fetchPost} from "../util/fetch";
import {Dialog} from "../dialog";
import {Constants} from "../constants";
import {focusByRange} from "../protyle/util/selection";
import {hideElements} from "../protyle/ui/hideElements";
import RecentDocs from "../components/recentDocs.vue";
import { createVueComponentInDialog, createSimpleVueComponentLoader, VueComponentMountConfig } from "../util/vue/mount";

// 处理文档选择事件
const handleDocSelected = (doc: { rootID: string, icon: string, title: string }) => {
    fetchPost("/api/filetree/openDoc", {
        id: doc.rootID,
        action: [0, 1]
    });
};

// 创建最近文档Vue应用配置
const createRecentDocsVueConfig = (recentDocs: any): VueComponentMountConfig => {
    return {
        components: {
            RecentDocs
        },
        data: {
            recentDocs
        },
        eventHandlers: {
            handleDocSelected
        },
        template: `<RecentDocs :recent-docs="recentDocs" @doc-selected="handleDocSelected" ref="recentDocsComponent" />`,
        initMethodName: "focusSearchInput"
    };
};

// 创建最近文档对话框
const createRecentDocsDialog = (recentDocs: any) => {
    let range: Range;
    if (getSelection().rangeCount > 0) {
        range = getSelection().getRangeAt(0);
    }
    
    const dialog = new Dialog({
        positionId: Constants.DIALOG_RECENTDOCS,
        title: `<div class="fn__flex">
<div class="fn__flex-center">${window.siyuan.languages.recentDocs}</div>
<div class="fn__flex-1"></div>
</div>`,
        content: "",
        height: "80vh",
        destroyCallback: () => {
            if (range && range.getBoundingClientRect().height !== 0) {
                focusByRange(range);
            }
        }
    });
    
    // 使用通用Vue组件加载器创建并挂载Vue应用
    createVueComponentInDialog(dialog, createRecentDocsVueConfig(recentDocs));
    
    dialog.element.setAttribute("data-key", Constants.DIALOG_RECENTDOCS);
    
    return dialog;
};

// 处理获取最近文档数据的回调
const handleRecentDocsResponse = (response: any) => {
    createRecentDocsDialog(response.data);
};

export const openRecentDocs = () => {
    const openRecentDocsDialog = window.siyuan.dialogs.find(item => {
        if (item.element.getAttribute("data-key") === Constants.DIALOG_RECENTDOCS) {
            return true;
        }
    });
    if (openRecentDocsDialog) {
        hideElements(["dialog"]);
        return;
    }
    fetchPost("/api/storage/getRecentDocs", {}, handleRecentDocsResponse);
};

/**
 * 创建一个函数,作用如下:
 * 1.打开最近窗口界面,等待用户选择
 * 2.如果用户选择了一个文档,那么返回这个文档的id
 * 3.如果是其它任何情况,返回空值
 */
export const selectRecentDoc = (): Promise<string | null> => {
    return new Promise((resolve) => {
        // 检查是否已经有打开的对话框
        const openRecentDocsDialog = window.siyuan.dialogs.find(item => {
            if (item.element.getAttribute("data-key") === Constants.DIALOG_RECENTDOCS) {
                return true;
            }
        });
        
        if (openRecentDocsDialog) {
            // 如果对话框已经打开，关闭它并返回null
            hideElements(["dialog"]);
            resolve(null);
            return;
        }

        // 保存当前选择范围
        let range: Range;
        if (getSelection().rangeCount > 0) {
            range = getSelection().getRangeAt(0);
        }

        // 创建对话框
        const dialog = new Dialog({
            positionId: Constants.DIALOG_RECENTDOCS,
            title: `<div class="fn__flex">
<div class="fn__flex-center">${window.siyuan.languages.recentDocs}</div>
<div class="fn__flex-1"></div>
</div>`,
            content: "",
            height: "80vh",
            destroyCallback: () => {
                // 对话框销毁时恢复焦点
                if (range && range.getBoundingClientRect().height !== 0) {
                    focusByRange(range);
                }
                // 如果用户没有选择文档就关闭对话框，返回null
                resolve(null);
            }
        });

        // 创建容器元素用于挂载 Vue 应用
        const container = document.createElement("div");
        dialog.element.querySelector(".b3-dialog__body").appendChild(container);

        // 获取最近文档数据
        fetchPost("/api/storage/getRecentDocs", {}, (response) => {
            // 处理文档选择事件
            const handleDocSelectedForSelect = (doc: { rootID: string, icon: string, title: string }) => {
                // 打开选中的文档
                fetchPost("/api/filetree/openDoc", {
                    id: doc.rootID,
                    action: [0, 1]
                });
                
                // 销毁对话框
                dialog.destroy();
                
                // 返回选中的文档ID
                resolve(doc.rootID);
            };

            // 使用通用Vue组件加载器创建并挂载Vue应用
            createSimpleVueComponentLoader(
                container,
                RecentDocs,
                {
                    recentDocs: response.data
                },
                {
                    handleDocSelected: handleDocSelectedForSelect
                },
                `<RecentDocs :recent-docs="recentDocs" @doc-selected="handleDocSelected" ref="recentDocsComponent" />`,
                "focusSearchInput"
            );
        });

        dialog.element.setAttribute("data-key", Constants.DIALOG_RECENTDOCS);
    });
};