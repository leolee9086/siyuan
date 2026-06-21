/** 用途：安全随机数生成。使用范围：genID 生成加密安全的 UUID。解耦评估：直接依赖标准环境访问层。 */
import { getRandomValues } from "../siyuanEnvironments/windowStandard.environment";

/**
 * 生成加密安全的 UUID
 * @作用 生成符合 UUID v4 格式的唯一标识符
 * @调用时机 创建新块、新文档等需要唯一 ID 的场景
 * @同步豁免: 性能考虑 — 纯数学计算 + 加密随机数，无异步依赖
 */
export const genUUID = () => ([1e7].toString() + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (parseInt(c, 10) ^ ((getRandomValues(new Uint32Array(1))[0] ?? 0) & (15 >> (parseInt(c, 10) / 4)))).toString(16)
);
