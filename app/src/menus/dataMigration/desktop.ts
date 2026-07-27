/** 用途：退出桌面宿主；使用范围：配置导入完成；解耦评估：经本子域网关直达终止实现。 */
import {exitSiYuan} from "./imports";
/** 用途：退出前保存桌面布局；使用范围：配置导入完成；解耦评估：经本子域网关直达布局实现。 */
import {exportLayout} from "./imports";
/** 用途：复用数据迁移业务实现；使用范围：桌面入口；解耦评估：宿主只固定完成动作。 */
import {openDataMigrationWithHost} from "./imports";
/** 用途：约束公开业务选项；使用范围：桌面入口；解耦评估：纯类型不依赖宿主实现。 */
import type {DataMigrationOptions} from "./imports";

/** 导入桌面配置后保存当前布局并退出，使新配置在下次内核启动时完整生效。 */
const finishDesktopConfigurationImport = () => {
    void exportLayout({errorExit: true, cb: exitSiYuan});
};

/** 打开桌面数据迁移界面，并在导入配置后先保存布局再退出。 */
/** @同步豁免: UI构建 - 菜单点击必须在当前事件栈内创建 Dialog，保持焦点、上传控件和原调用时序。 */
// @柯里化: 桌面宿主在此固定配置导入后的布局保存语义，调用方只提供数据迁移业务选项。
export const openDesktopDataMigration = (options: DataMigrationOptions = {}) => {
    openDataMigrationWithHost({
        ...options,
        onConfigurationImported: finishDesktopConfigurationImport,
    });
};
