import {fetchPost} from "../util/fetch";
import {Dialog} from "../dialog";
import {Constants} from "../constants";
import {focusByRange} from "../protyle/util/selection";
import {hideElements} from "../protyle/ui/hideElements";
import { createVueComponentInDialog, VueComponentMountConfig } from "../util/vue/mount";
import RecentDocs from "../components/recentDocsAndDocks.vue";
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
    
    // 创建标题Vue组件配置
    const titleVueConfig: VueComponentMountConfig = {
        components: {
            RecentDocs
        },
        data: {
            recentDocs
        },
        eventHandlers: {
            handleDocSelected
        },
        template: `<div class="fn__flex">
<div class="fn__flex-center">${window.siyuan.languages.recentDocs}</div>
<div class="fn__flex-1"></div>
</div>`,
    };
    
    const dialog = new Dialog({
        positionId: Constants.DIALOG_RECENTDOCS,
        titleVueConfig: titleVueConfig,
        content: "",
        height: "80vh",
        destroyCallback: () => {
            if (range && range.getBoundingClientRect().height !== 0) {
                focusByRange(range);
            }
        }
    });
    
    // 使用通用Vue组件加载器创建并挂载Vue应用到对话框内容区域
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

