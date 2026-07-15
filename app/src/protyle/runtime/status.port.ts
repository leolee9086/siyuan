import {getSForgeState, setSForgeState} from "../../config/sforge.global";
import {SForgeSymbols} from "../../config/sforge.symbols";
import type {IProtyleStatusPort, StatusElementTarget} from "./status.types";

/** 导出状态统计宿主能力契约，供独立入口和完整 App 适配器共享。 */
export type {IProtyleStatusPort, StatusElementTarget} from "./status.types";

/** 无状态栏时的明确降级行为；编辑器核心输入和事务不依赖统计能力。 */
const fallbackPort: IProtyleStatusPort = {
    countSelection: () => undefined,
    countBlocks: () => undefined,
    clear: () => undefined,
};

/** 获取当前宿主注册的状态统计能力。 */
export const getProtyleStatusPort = (): IProtyleStatusPort => {
    return getSForgeState(SForgeSymbols.STATUS_PORT) || fallbackPort;
};

/** 注册完整 App 或独立宿主提供的状态统计能力。 */
export const setProtyleStatusPort = (port: IProtyleStatusPort) => {
    setSForgeState(SForgeSymbols.STATUS_PORT, port);
};

/** 测试或宿主销毁时清除注册，使后续调用回退到 no-op。 */
export const resetProtyleStatusPort = () => {
    setSForgeState(SForgeSymbols.STATUS_PORT, undefined);
};

/** 保持现有调用点签名，内部转发到类型化状态统计 Port。 */
export const countSelectWord = (range: Range, rootId?: string, status?: StatusElementTarget) => {
    getProtyleStatusPort().countSelection(range, rootId, status);
};

/** 保持现有调用点签名，内部转发到类型化状态统计 Port。 */
export const countBlockWord = (ids: string[], rootId?: string, clearCache = false, status?: StatusElementTarget) => {
    getProtyleStatusPort().countBlocks(ids, rootId, clearCache, status);
};

/** 清理当前宿主的状态统计。 */
export const clearCounter = (status?: StatusElementTarget) => {
    getProtyleStatusPort().clear(status);
};
