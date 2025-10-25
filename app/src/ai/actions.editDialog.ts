import { Constants } from "../constants";
import { Dialog } from "../dialog";
import { setStorageVal } from "../protyle/util/compatibility";
import { isMobile } from "../util/functions";
import { createVueComponentInDialog, VueComponentMountConfig } from "../util/vue/mount";
import AiEditDialog from "../components/aiEditDialog.vue";

// 处理取消事件
const handleCancel = (dialog: Dialog) => {
    dialog.destroy();
};

// 处理确认事件
const handleConfirm = (
    dialog: Dialog,
    name: string,
    memo: string,
    originalName: string,
    originalMemo: string
) => {
    window.siyuan.storage[Constants.LOCAL_AI].find((subItem: {
        name: string;
        memo: string;
    }) => {
        if (originalName === subItem.name && originalMemo === subItem.memo) {
            subItem.name = name;
            subItem.memo = memo;
            setStorageVal(Constants.LOCAL_AI, window.siyuan.storage[Constants.LOCAL_AI]);
            return true;
        }
    });
    dialog.destroy();
};

// 处理删除事件
const handleDelete = (
    dialog: Dialog,
    originalName: string,
    originalMemo: string
) => {
    window.siyuan.storage[Constants.LOCAL_AI].find((subItem: {
        name: string;
        memo: string;
    }, index: number) => {
        if (originalName === subItem.name && originalMemo === subItem.memo) {
            window.siyuan.storage[Constants.LOCAL_AI].splice(index, 1);
            setStorageVal(Constants.LOCAL_AI, window.siyuan.storage[Constants.LOCAL_AI]);
            return true;
        }
    });
    dialog.destroy();
};

// 创建编辑对话框Vue应用配置
const createEditDialogVueConfig = (customName: string, customMemo: string, dialog: Dialog): VueComponentMountConfig => {
    return {
        components: {
            AiEditDialog
        },
        data: {
            name: customName,
            memo: customMemo
        },
        eventHandlers: {
            handleCancel: () => handleCancel(dialog),
            handleConfirm: (name: string, memo: string) => handleConfirm(dialog, name, memo, customName, customMemo),
            handleDelete: () => handleDelete(dialog, customName, customMemo)
        },
        template: `<AiEditDialog :name="name" :memo="memo" @cancel="handleCancel" @confirm="handleConfirm" @delete="handleDelete" ref="aiEditDialogComponent" />`,
        initMethodName: "focusSearchInput"
    };
};

export const editDialog = (customName: string, customMemo: string) => {
    const dialog = new Dialog({
        title: window.siyuan.languages.update,
        content: "",
        width: isMobile() ? "92vw" : "520px",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_AIUPDATECUSTOMACTION);
    
     createVueComponentInDialog(dialog, createEditDialogVueConfig(customName, customMemo, dialog))

    
    return dialog;
};
