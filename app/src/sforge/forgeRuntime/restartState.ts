/** 用途：读取接续注册状态；使用范围：状态机入口和 Model 错误门控；解耦评估：必须读取全局唯一状态，依赖注入会使多个入口观察到不同实例。 */
import {getSForgeState} from "./imports";
/** 用途：写入接续注册状态；使用范围：开始、Promise 登记和终态清理；解耦评估：状态变更必须在同一全局槽内原子可见，事件传递无法替代。 */
import {setSForgeState} from "./imports";
/** 用途：定位接续状态槽；使用范围：全部状态读写；解耦评估：使用共享 Symbol 保证跨模块身份稳定，不能通过字符串或参数复制。 */
import {FORGE_RUNTIME_ELECTRON_CONTINUITY} from "./imports";
/** 用途：约束接续任务身份；使用范围：开始和重复事件比较；解耦评估：纯类型契约由领域类型统一维护，无运行时耦合。 */
import type {ForgeRuntimeElectronContinuityContext} from "./types";
/** 用途：约束接续 Promise 终态；使用范围：Promise 登记和清理；解耦评估：纯类型契约无需依赖注入。 */
import type {ForgeRuntimeElectronContinuityResult} from "./types";
/** 用途：约束全局状态槽结构；使用范围：首次创建和注册表写入；解耦评估：状态结构必须与领域类型同源，复制接口会产生漂移。 */
import type {ForgeRuntimeElectronContinuityState} from "./types";

/** 创建结构完整的初始状态，避免全局注册表出现半初始化字段。 */
const createState = () => ({
    active: false,
    context: undefined,
    promise: undefined,
} satisfies ForgeRuntimeElectronContinuityState);

/** 获取全局 Electron 接续状态；缺失时原子创建唯一状态槽。 @同步豁免: 生命周期 - Model 错误门控必须在当前事件栈内读取同一状态。 */
export const getForgeRuntimeElectronRestartState = () => {
    const existing = getSForgeState(FORGE_RUNTIME_ELECTRON_CONTINUITY);
    if (existing) {
        return existing;
    }
    const state = createState();
    setSForgeState(FORGE_RUNTIME_ELECTRON_CONTINUITY, state);
    return state;
};

/** 登记当前接续任务及其身份，供 Model 和重复事件边界读取。 @同步豁免: 生命周期 - 原始 exit 事件必须在 WebSocket close/error 之前同步登记。 */
export const beginForgeRuntimeElectronRestart = (context: ForgeRuntimeElectronContinuityContext) => {
    const state = getForgeRuntimeElectronRestartState();
    state.active = true;
    state.context = context;
    state.promise = undefined;
    setSForgeState(FORGE_RUNTIME_ELECTRON_CONTINUITY, state);
};

/** 登记接续 Promise；Promise 身份用于避免旧任务清理新任务状态。 @同步豁免: 生命周期 - Promise 创建后必须立即写入全局槽供重复事件去重。 */
export const setForgeRuntimeElectronRestartPromise = (promise: Promise<ForgeRuntimeElectronContinuityResult>) => {
    const state = getForgeRuntimeElectronRestartState();
    state.promise = promise;
    setSForgeState(FORGE_RUNTIME_ELECTRON_CONTINUITY, state);
};

/** 标记 Electron 主界面正在等待 Kernel 热替换完成。 @同步豁免: 生命周期 - 终态清理必须在 Promise 结算回调内立即完成。 */
export const endForgeRuntimeElectronRestart = (promise?: Promise<ForgeRuntimeElectronContinuityResult>) => {
    const state = getForgeRuntimeElectronRestartState();
    if (promise && state.promise !== promise) {
        return;
    }
    state.active = false;
    state.context = undefined;
    state.promise = undefined;
    setSForgeState(FORGE_RUNTIME_ELECTRON_CONTINUITY, state);
};

/** 供 Model 与 Forge Runtime 控制器抑制停机期间的错误副作用。 @同步豁免: 生命周期 - 错误回调需要同步读取停机门控。 */
export const isForgeRuntimeElectronRestartActive = () => getForgeRuntimeElectronRestartState().active;
