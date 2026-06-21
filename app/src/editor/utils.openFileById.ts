/** 用途：应用实例类型。使用范围：openFileById 参数类型标注。解耦评估：通过 ./imports 转发。 */
import type { App } from "./imports";
/** 用途：显示提示消息。使用范围：文件不存在时的用户提示。解耦评估：通过 ./imports 转发。 */
import { showMessage } from "./imports";
/** 用途：布局模型类型。使用范围：openFileById 回调参数。解耦评估：通过 ./imports 转发。 */
import { Model } from "./imports";
/** 用途：同步 POST 请求。使用范围：获取块信息。解耦评估：通过 ./imports 转发。 */
import { fetchSyncPost } from "./imports";
/** 用途：核心文件打开逻辑。使用范围：openFileById 获取块信息后调用。解耦评估：同目录模块直接导入。 */
import { openFile } from "./util";


/** 根据 ID 打开文件块 */
export const openFileById = async (options: {
    app: App;
    id: string;
    position?: string | undefined;
    mode?: TEditorMode | undefined;
    action?: TProtyleAction[] | undefined;
    keepCursor?: boolean | undefined;
    zoomIn?: boolean | undefined;
    removeCurrentTab?: boolean | undefined;
    openNewTab?: boolean | undefined;
    afterOpen?: ((model?: Model) => void) | undefined;
}) => {
    const response = await fetchSyncPost("/api/block/getBlockInfo", { id: options.id });
    if (response.code === -1) {
        return;
    }
    // 块已删除或无权访问时显示错误消息
    if (response.code === 3) {
        showMessage(response.msg);
        return;
    }

    return openFile({
        app: options.app,
        fileName: response.data.rootTitle,
        rootTitleEmpty: response.data.rootTitleEmpty,
        rootIcon: response.data.rootIcon,
        rootID: response.data.rootID,
        id: options.id,
        position: options.position,
        mode: options.mode,
        action: options.action,
        zoomIn: options.zoomIn,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        afterOpen: options.afterOpen,
        openNewTab: options.openNewTab
    });
};


