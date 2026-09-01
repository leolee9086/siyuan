import type {TDatabaseItemNavigator} from "./openDatabaseItem.types";

/** 数据库条目导航能力的 Symbol 注册键，跨入口共享同一宿主槽位。 */
const databaseItemNavigatorKey = Symbol.for("sforge.av.databaseItemNavigator");

/** 未装配完整应用时的明确失败回退。 */
const rejectDatabaseItem: TDatabaseItemNavigator = () => false;

/** 检查未知值是否为可调用的数据库条目导航实现。 */
const isDatabaseItemNavigator = (value: unknown): value is TDatabaseItemNavigator => {
    return typeof value === "function";
};

/** 读取当前宿主的数据库条目导航实现。 */
export const getDatabaseItemNavigator = () => {
    const value = Reflect.get(globalThis, databaseItemNavigatorKey);
    if (isDatabaseItemNavigator(value)) {
        return value;
    }
    return rejectDatabaseItem;
};

/** 注册桌面或移动宿主的数据库条目导航实现。 */
export const setDatabaseItemNavigator = (navigator: TDatabaseItemNavigator) => {
    if (!Reflect.set(globalThis, databaseItemNavigatorKey, navigator)) {
        throw new Error("Unable to register database item navigator");
    }
};
