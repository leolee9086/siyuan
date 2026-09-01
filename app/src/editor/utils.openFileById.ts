/** 用途：应用实例类型。使用范围：openFileById 参数类型标注。解耦评估：通过 ./imports 转发。 */
import type { AppFacade } from "./imports";
/** 用途：显示提示消息。使用范围：文件不存在时的用户提示。解耦评估：通过 ./imports 转发。 */
import { showMessage } from "./imports";
/** 用途：布局模型类型。使用范围：openFileById 回调参数。解耦评估：通过 ./imports 转发。 */
import type {ILayoutModel} from "./imports";
/** 用途：同步 POST 请求。使用范围：获取块信息。解耦评估：通过 ./imports 转发。 */
import { fetchSyncPost } from "./imports";
/** 用途：核心文件打开逻辑。使用范围：openFileById 获取块信息后调用。解耦评估：同目录稳定领域实现。 */
import {openFile} from "./open/openFile";
/** 用途：提供块打开 action 常量。使用范围：数据库条目打开时构造上下文与根滚动 action。解耦评估：通过 editor imports 网关获取全局协议常量，避免 owner 直接跨层依赖。 */
import {Constants} from "./imports";
/** 用途：注册桌面数据库条目导航实现。使用范围：模块加载后将打开逻辑提供给 AV port。解耦评估：通过 editor imports 网关保留 AV port 边界。 */
import {setDatabaseItemNavigator} from "./imports";
/** 用途：获取 AV 条目定位渲染器。使用范围：打开文档后的排队定位激活。解耦评估：通过 editor imports 网关和 renderer port 获取，避免加载 AV 渲染实现。 */
import {getAVLocateRenderer} from "./imports";
/** 用途：消费排队的 AV 条目定位请求。使用范围：目标 Protyle 打开完成后。解耦评估：通过 editor imports 网关调用 activation owner。 */
import {activateQueuedAVLocate} from "./imports";
/** 用途：标注数据库条目打开数据。使用范围：桌面 navigator 的类型边界。解耦评估：通过 editor imports 网关转发，纯类型不会产生运行时 AV 依赖。 */
import type {IDatabaseItemOpenData} from "./imports";
/** 用途：标注数据库条目打开选项。使用范围：桌面 navigator 的类型边界。解耦评估：通过 editor imports 网关转发，纯类型不会产生运行时 AV 依赖。 */
import type {IDatabaseItemOpenOptions} from "./imports";


/** 根据 ID 打开文件块 */
export const openFileById = async (options: {
    app: AppFacade;
    id: string;
    notebookId?: string | undefined;
    position?: string | undefined;
    mode?: TEditorMode | undefined;
    action?: TProtyleAction[] | undefined;
    keepCursor?: boolean | undefined;
    zoomIn?: boolean | undefined;
    removeCurrentTab?: boolean | undefined;
    openNewTab?: boolean | undefined;
    afterOpen?: ((model?: ILayoutModel) => void) | undefined;
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

    const zoomIn = options.zoomIn === true && options.id !== response.data.rootID;
    return openFile({
        app: options.app,
        fileName: response.data.rootTitle,
        rootTitleEmpty: response.data.rootTitleEmpty,
        rootIcon: response.data.rootIcon,
        rootID: response.data.rootID,
        id: options.id,
        notebookId: options.notebookId,
        position: options.position,
        mode: options.mode,
        action: options.action,
        zoomIn,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        afterOpen: options.afterOpen,
        openNewTab: options.openNewTab
    });
};

/** 在打开回调中定位目标编辑器，并消费排队的 AV 条目定位请求。 */
const activateDatabaseItem = (app: AppFacade, blockID: string) => {
    const editor = app.getOpenEditors().find((item) => item.protyle.block.id === blockID);
    if (editor) {
        activateQueuedAVLocate({renderAV: getAVLocateRenderer(), protyle: editor.protyle, blockID});
    }
};

/** 桌面宿主的数据库条目导航实现，保留打开后定位回调。 */
const openDatabaseItemOnDesktop = async (
    app: AppFacade,
    data: IDatabaseItemOpenData,
    options?: IDatabaseItemOpenOptions,
) => {
    const action: TProtyleAction[] = [Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL];
    const opened = await openFileById({
        app,
        id: data.databaseBlockID,
        notebookId: data.notebookID,
        position: options?.position,
        action,
        zoomIn: false,
        afterOpen: activateDatabaseItem.bind(null, app, data.databaseBlockID),
    });
    return Boolean(opened);
};

setDatabaseItemNavigator(openDatabaseItemOnDesktop);

