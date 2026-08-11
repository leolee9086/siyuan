/**
 * Forge Runtime 状态注册表导入门面。
 *
 * 运行时控制模块只能通过这里取得全局注册表和稳定 Symbol；
 * 这样同步生命周期状态不会把 config 实现细节扩散到接续状态机。
 */
/** 用途：读取 Forge Runtime 全局状态；使用范围：接续状态初始化和重复事件去重；解耦评估：注册表是跨模块唯一状态边界，参数传递会产生分裂实例。 */
import {getSForgeState} from "../../config/sforge.global";
/** 用途：写入 Forge Runtime 全局状态；使用范围：接续开始、Promise 登记和终态清理；解耦评估：状态所有权必须集中于全局注册表，事件广播不能保证同一调用栈内可见。 */
import {setSForgeState} from "../../config/sforge.global";
/** 用途：定位 Electron 接续状态槽；使用范围：restartState 的唯一状态键；解耦评估：Symbol 身份需要与全局映射同源，不能复制字符串键。 */
import {FORGE_RUNTIME_ELECTRON_CONTINUITY} from "../../config/sforge.symbols";
/** 导出 Forge Runtime 状态读取能力；使用范围：restartState 的状态读取；解耦评估：调用方只依赖本领域门面，避免跨层实现导入。 */
export {getSForgeState};
/** 导出 Forge Runtime 状态写入能力；使用范围：restartState 的状态写入；解耦评估：调用方只依赖本领域门面，避免跨层实现导入。 */
export {setSForgeState};
/** 导出 Electron 接续状态键；使用范围：restartState 的唯一槽定位；解耦评估：稳定 Symbol 必须由同一门面提供，不能复制字符串键。 */
export {FORGE_RUNTIME_ELECTRON_CONTINUITY};
