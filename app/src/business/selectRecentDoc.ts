import RecentDocs from "../components/recentDocsAndDocks.vue";
import { Constants } from "../constants";
import { Dialog } from "../dialog";
import { focusByRange } from "../protyle/util/selection";
import { getFirstSelectedRange } from "../util/DOM/selection/range.global";
import { fetchPost } from "../util/network/fetch";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { createVueComponentInDialog } from "../util/vue/mount";
import type { VueComponentMountConfig } from "../util/vue/mount.types";

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
            // 如果对话框已经打开，关闭它
            openRecentDocsDialog.destroy();
        }

        // 保存当前选择范围
        const range = getFirstSelectedRange();

        // 处理文档选择事件
        const handleDocSelectedForSelect = (doc: { rootID: string; icon: string; title: string; }) => {
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
                    handleDocSelected: handleDocSelectedForSelect
                },
                template: "<RecentDocs :recent-docs=\"recentDocs\" @doc-selected=\"handleDocSelected\" ref=\"recentDocsComponent\" />",
                initMethodName: "focusSearchInput"
            };
        };

        // 创建标题Vue组件配置
        const titleVueConfig: VueComponentMountConfig = {
            components: {
                RecentDocs
            },
            data: {
                recentDocs: [] // 这里先传空数组，后面会更新
            },
            eventHandlers: {
                handleDocSelected: handleDocSelectedForSelect
            },
            template: `<div class="fn__flex">
<div class="fn__flex-center">${siyuanI18n.recentDocs}</div>
<div class="fn__flex-1"></div>
</div>`,
        };

        // 创建对话框
        const dialog = new Dialog({
            positionId: Constants.DIALOG_RECENTDOCS,
            titleVueConfig: titleVueConfig,
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

        // 获取最近文档数据
        fetchPost("/api/storage/getRecentDocs", {}, (response) => {
            // 使用通用Vue组件加载器创建并挂载Vue应用到对话框内容区域
            createVueComponentInDialog(dialog, createRecentDocsVueConfig(response.data));
        });

        dialog.element.setAttribute("data-key", Constants.DIALOG_RECENTDOCS);
    });
};
