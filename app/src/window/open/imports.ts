/** 用途：构造窗口 URL 与资源类型判断；使用范围：三种独立窗口创建流程；解耦评估：稳定常量直接依赖，不应复制或参数化。 */
import {Constants} from "../../constants";
/** 用途：显示块不存在错误；使用范围：按块 ID 打开窗口的失败分支；解耦评估：这是既有全局消息语义，参数化会把基础设施细节扩散给调用者。 */
import {showMessage} from "../../dialog/message";
/** 用途：描述可序列化并可从父窗口移除的完整页签；使用范围：移动现有页签到新窗口；解耦评估：只依赖已双向校验的领域根，不加载具体 Tab。 */
import type {LayoutTab} from "../../layout/layout.types";
/** 用途：生成现有页签的持久化布局；使用范围：移动现有页签到新窗口；解耦评估：布局序列化是独立领域唯一实现，继续直达该实现。 */
import {layoutToJSON} from "../../layout/persistence/layoutSerializer";
/** 用途：阻止 Web 端发送桌面窗口指令；使用范围：资源独立窗口与默认创建器；解耦评估：运行平台是执行前置事实，不由业务调用者重复传递。 */
import {isElectron} from "../../platform";
/** 用途：请求 Electron 主进程创建窗口；使用范围：默认窗口创建器；解耦评估：自定义创建方式已由 WindowOptions 参数化，默认适配器仍应直达 IPC 唯一实现。 */
import {ipcSend} from "../../platform/electron/ipcRenderer";
/** 用途：解析资源显示名和扩展名；使用范围：资源独立窗口；解耦评估：纯路径规则已有唯一实现，参数化会造成规则重复。 */
import {getDisplayName, pathPosix} from "../../util/file/pathName";
/** 用途：按块 ID 获取窗口恢复数据；使用范围：按块 ID 打开窗口；解耦评估：请求顺序属于该命令语义，继续直达网络原语。 */
import {fetchSyncPost} from "../../util/network/fetch";
/** 用途：读取资源 URL 页码；使用范围：资源独立窗口；解耦评估：纯查询解析已有唯一实现，不引入宿主状态。 */
import {getSearch} from "../../util/platform/functions";
/** 用途：构造与当前应用同源的新窗口地址；使用范围：全部窗口创建流程；解耦评估：当前地址是执行期环境事实，集中从环境访问器读取。 */
import {
    getLocationHost,
    getLocationProtocol,
} from "../../util/siyuanEnvironments/windowLocation.environment";

/** 导出窗口 URL 与资源类型常量。 */
export {Constants};
/** 导出块信息同步请求原语。 */
export {fetchSyncPost};
/** 导出资源显示名解析规则。 */
export {getDisplayName};
/** 导出当前窗口主机名访问器。 */
export {getLocationHost};
/** 导出当前窗口协议访问器。 */
export {getLocationProtocol};
/** 导出资源 URL 查询参数解析规则。 */
export {getSearch};
/** 导出 Electron IPC 发送原语。 */
export {ipcSend};
/** 导出 Electron 平台事实。 */
export {isElectron};
/** 导出布局序列化唯一实现。 */
export {layoutToJSON};
/** 导出 POSIX 路径操作。 */
export {pathPosix};
/** 导出全局消息展示实现。 */
export {showMessage};
/** 窗口创建只依赖完整布局页签领域根，不加载具体 Tab class。 */
export type {LayoutTab};
