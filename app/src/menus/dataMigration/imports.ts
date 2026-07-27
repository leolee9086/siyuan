/** 用途：退出应用宿主；使用范围：配置导入完成；解耦评估：直达唯一进程动作实现。 */
import {exitSiYuan} from "../../dialog/processSystem";
/** 用途：保存桌面布局；使用范围：桌面配置导入完成；解耦评估：直达唯一布局导出实现。 */
import {exportLayout} from "../../layout/export/exportLayout";
/** 用途：数据迁移共享业务；使用范围：桌面与移动宿主入口；解耦评估：直达父域唯一实现。 */
import {openDataMigrationWithHost} from "../dataMigration";
/** 用途：数据迁移公开选项；使用范围：宿主入口参数；解耦评估：纯类型不加载宿主实现。 */
import type {DataMigrationOptions} from "../dataMigration";

/** 应用退出动作。 */
export {exitSiYuan};
/** 桌面布局保存动作。 */
export {exportLayout};
/** 数据迁移共享业务入口。 */
export {openDataMigrationWithHost};
/** 数据迁移公开选项类型。 */
export type {DataMigrationOptions};
