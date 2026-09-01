/** AV 固定行能力的最小契约。 */
export type TStickyRow = (blockElement: HTMLElement, scrollElement: HTMLElement, status: "top" | "bottom" | "all") => void;

/** AV 固定行能力的跨模块注册键。 */
const stickyRowKey = Symbol.for("sforge.av.stickyRow");

/** 未装配 AV 行模块时的明确回退。 */
const ignoreStickyRow: TStickyRow = () => undefined;

/** 校验未知注册值是否为固定行实现。 */
const isStickyRow = (value: unknown): value is TStickyRow => {
    return typeof value === "function";
};

/** 读取当前宿主的固定行实现。 */
export const getStickyRow = () => {
    const value = Reflect.get(globalThis, stickyRowKey);
    if (isStickyRow(value)) {
        return value;
    }
    return ignoreStickyRow;
};

/** 注册 AV 行模块提供的固定行实现。 */
export const setStickyRow = (stickyRow: TStickyRow) => {
    if (!Reflect.set(globalThis, stickyRowKey, stickyRow)) {
        throw new Error("Unable to register AV sticky row");
    }
};
