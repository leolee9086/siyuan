/**
 * tabOpen.guard.ts - 普通 Tab 打开 Port 的类型守卫
 *
 * 全局 Symbol 注册表以 Symbol 键存储值，键无法保留 unique symbol 字面量，
 * 读取方得到的是所有注册值的联合类型（含 null 等无关分支）；
 * 本文件在 Port 边界把弱类型值恢复为强类型能力契约。
 */

/** 用途：声明普通 Tab 打开 Port 类型。使用范围：Port 边界类型恢复；解耦评估：纯类型依赖。 */
import type {ILayoutTabOpenPort} from "./tabOpen.types";

/**
 * 将全局 Symbol 注册表中的弱类型值断言为普通 Tab 打开 Port。
 * 未注册时返回 undefined，由调用方按未注册语义处理。
 */
export function asLayoutTabOpenPort(val: unknown): ILayoutTabOpenPort | undefined {
    return val as ILayoutTabOpenPort | undefined;
}
