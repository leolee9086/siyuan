/** 用途：引导文档动作常量；使用范围：桌面与移动宿主；解耦评估：直达稳定协议声明。 */
import {Constants} from "../constants";
/** 用途：桌面引导文档导航；使用范围：桌面宿主；解耦评估：直达桌面导航唯一实现。 */
import {openFileById} from "../editor/utils.openFileById";
/** 用途：移动引导文档导航；使用范围：移动宿主；解耦评估：直达移动导航唯一实现。 */
import {openMobileFileByIdViaPort as openMobileFileById} from "../plugin/api/openMobileFile.port";
/** 用途：笔记本准备；使用范围：两类宿主激活流程；解耦评估：直达唯一生命周期实现。 */
import {setNoteBook} from "../util/file/pathName";
/** 用途：桌面数据迁移入口；使用范围：桌面引导；解耦评估：直达桌面宿主实现。 */
import {openDesktopDataMigration} from "../menus/dataMigration/desktop";
/** 用途：移动数据迁移入口；使用范围：移动引导；解耦评估：直达移动宿主实现。 */
import {openMobileDataMigration} from "../menus/dataMigration/mobile";
/** 用途：已初始化配置访问；使用范围：两类宿主；解耦评估：直达环境守卫。 */
import {getSiyuanConfig} from "../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：读取当前编辑器页签；使用范围：桌面引导防重复打开；解耦评估：直达布局查询唯一实现。 */
import {getAllTabs} from "../layout/getAll";
/** 用途：读取启动 URI 中的块标识；使用范围：桌面引导防重复打开；解耦评估：直达 URI 协议解析实现。 */
import {parseUriInfo} from "../util/uri/protocol";
/** 用途：完整应用外观；使用范围：两类宿主类型边界；解耦评估：纯类型不加载具体实现。 */
import type {AppFacade} from "../app/AppFacade.types";
/** 用途：持久化与确认引导状态；使用范围：共享引导业务；解耦评估：直达统一网络实现。 */
import {fetchPost} from "../util/network/fetch";
/** 用途：同步确认引导状态；使用范围：共享引导业务；解耦评估：直达统一网络实现。 */
import {fetchSyncPost} from "../util/network/fetch";
/** 用途：打开用户指南；使用范围：引导帮助动作；解耦评估：直达唯一帮助实现。 */
import {mountHelp} from "../util/file/mount";
/** 用途：启动同步引导；使用范围：引导同步动作；解耦评估：直达唯一同步实现。 */
import {syncGuide} from "../sync/syncGuide";
/** 用途：打开同步设置；使用范围：未登录引导；解耦评估：直达完整配置入口。 */
import {openSetting} from "../config";
/** 用途：判断账户同步资格；使用范围：引导登录分派；解耦评估：直达统一订阅规则。 */
import {isPaidUser} from "../util/platform/needSubscribe";
/** 用途：约束数据迁移业务参数；使用范围：引导导入动作；解耦评估：纯类型不加载宿主。 */
import type {DataMigrationOptions} from "../menus/dataMigration";

/** 桌面与移动引导打开文档时使用的协议动作常量。 */
export {Constants};
/** 桌面引导文档导航唯一实现。 */
export {openFileById};
/** 移动引导文档导航唯一实现。 */
export {openMobileFileById};
/** 引导激活前的笔记本准备生命周期。 */
export {setNoteBook};
/** 桌面数据迁移宿主入口。 */
export {openDesktopDataMigration};
/** 移动数据迁移宿主入口。 */
export {openMobileDataMigration};
/** 已初始化思源配置的显式环境访问器。 */
export {getSiyuanConfig};
/** 当前编辑器页签查询。 */
export {getAllTabs};
/** 启动 URI 协议解析。 */
export {parseUriInfo};
/** 完整应用外观类型，不加载具体 App。 */
export type {AppFacade};
/** 引导状态持久化请求。 */
export {fetchPost};
/** 引导状态同步确认请求。 */
export {fetchSyncPost};
/** 用户指南挂载能力。 */
export {mountHelp};
/** 同步引导能力。 */
export {syncGuide};
/** 同步设置入口。 */
export {openSetting};
/** 账户同步资格判定。 */
export {isPaidUser};
/** 数据迁移业务参数类型。 */
export type {DataMigrationOptions};
