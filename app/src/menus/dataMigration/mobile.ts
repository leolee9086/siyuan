/** 用途：退出移动宿主；使用范围：配置导入完成；解耦评估：经本子域网关直达终止实现。 */
import {exitSiYuan} from "./imports";
/** 用途：复用数据迁移业务实现；使用范围：移动入口；解耦评估：宿主只固定完成动作。 */
import {openDataMigrationWithHost} from "./imports";
/** 用途：约束公开业务选项；使用范围：移动入口；解耦评估：纯类型不依赖宿主实现。 */
import type {DataMigrationOptions} from "./imports";

/** 导入移动配置后退出当前宿主，使新配置在下次内核启动时完整生效。 */
const finishMobileConfigurationImport = () => {
    void exitSiYuan();
};

/** 打开移动数据迁移界面，并在导入配置后直接退出当前移动宿主。 */
/** @同步豁免: UI构建 - 菜单点击必须在当前事件栈内创建 Dialog，保持焦点、上传控件和原调用时序。 */
// @柯里化: 移动宿主在此固定配置导入后的直接退出语义，调用方只提供数据迁移业务选项。
export const openMobileDataMigration = (options: DataMigrationOptions = {}) => {
    openDataMigrationWithHost({
        ...options,
        onConfigurationImported: finishMobileConfigurationImport,
    });
};
