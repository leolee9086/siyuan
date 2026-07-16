/** 用途：颜色工具 Vue 根面板；使用范围：原生颜色对话框挂载；解耦评估：UI 组件通过对话框容器注入，不依赖插件加载器。 */
import ColorToolPanel from "./ColorToolPanel.vue";
/** 用途：创建对话框、Dialog 类型和平台尺寸；使用范围：颜色工具打开/销毁流程；解耦评估：基础 UI 能力由颜色网关集中提供。 */
import {createVueDialog, Dialog, isMobile} from "./imports";

const dialogState: {current: Dialog | null} = {current: null};

/** 打开或聚焦颜色工具对话框，可选地把图片地址作为初始取色源。 */
export const openColorTool = (imageSrc = "") => {
    if (dialogState.current && !imageSrc) {
        dialogState.current.element.querySelector("input")?.focus();
        return dialogState.current;
    }
    dialogState.current?.destroy();
    dialogState.current = null;
    let dialog: Dialog;
    dialog = createVueDialog({
        dataKey: "dialog-sforge-colors",
        vueConfigFactory: () => ({
            components: {ColorToolPanel},
            data: {imageSrc},
            eventHandlers: {
                close: () => dialog?.destroy(),
            },
            template: "<ColorToolPanel :initial-image-src=\"imageSrc\" @close=\"close\" />",
        }),
        dialogOptions: {
            title: "颜色工具",
            width: isMobile() ? "96vw" : "920px",
            height: isMobile() ? "86vh" : "760px",
            transparent: false,
            closeButtonPosition: "inside",
            destroyCallback: () => {
                if (dialogState.current === dialog) {
                    dialogState.current = null;
                }
            },
        },
    });
    dialogState.current = dialog;
    return dialog;
};

/** 查询颜色工具是否已经打开，供状态栏按钮切换行为使用。 */
export const colorToolIsOpen = () => dialogState.current !== null;
