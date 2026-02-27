import {
    MODE_MIDDLEWARE_FUNCTION,
    ModeEntry
} from "./modeRouter.types";
import { deepEqual } from "./deepEqual";

/**
 * 模式注册表 - 存储模式和处理函数的映射
 * 注册表在注册函数时使用
 */
export class Registry<M, CTX> {
    private modeEntries: Map<string, ModeEntry<M, CTX>> = new Map();

    add(methodName: string, mode: M, handler: MODE_MIDDLEWARE_FUNCTION<CTX>): void {
        const key = `${methodName}:${JSON.stringify(mode)}`;
        const existingEntry = this.modeEntries.get(key);

        if (existingEntry) {
            existingEntry.handlers.push(handler);
            return;
        }
        this.modeEntries.set(key, {
            mode,
            handlers: [handler]
        });
    }

    get(methodName: string, mode: M): MODE_MIDDLEWARE_FUNCTION<CTX>[] {
        const key = `${methodName}:${JSON.stringify(mode)}`;
        const entry = this.modeEntries.get(key);
        return entry ? entry.handlers : [];
    }

    has(methodName: string, mode: M): boolean {
        const key = `${methodName}:${JSON.stringify(mode)}`;
        return this.modeEntries.has(key);
    }

    getAllModes(methodName: string): M[] {
        const modes: M[] = [];
        for (const [key, entry] of this.modeEntries) {
            if (key.startsWith(`${methodName}:`)) {
                modes.push(entry.mode);
            }
        }
        return modes;
    }

    clear(): void {
        this.modeEntries.clear();
    }
}


/**
 * 处理栈 - 存储模式和处理函数的列表，使用深度比对来查找匹配的模式
 * 栈在实际处理时使用
 */
export class Stack<M, CTX> {
    private modeEntries: ModeEntry<M, CTX>[] = [];

    add(mode: M, handler: MODE_MIDDLEWARE_FUNCTION<CTX>): void {
        const existingEntry = this.modeEntries.find(entry => deepEqual(entry.mode, mode));
        if (existingEntry) {
            existingEntry.handlers.push(handler);
            return;
        }
        this.modeEntries.push({ mode, handlers: [handler] });
    }

    get(mode: M): MODE_MIDDLEWARE_FUNCTION<CTX>[] {
        const entry = this.modeEntries.find(entry => deepEqual(entry.mode, mode));
        return entry ? entry.handlers : [];
    }

    has(mode: M): boolean {
        return this.modeEntries.some(entry => deepEqual(entry.mode, mode));
    }
}


/**
 * 执行洋葱路由 dispatch 链
 */
export const executeDispatchChain = async <CTX>(
    handlers: MODE_MIDDLEWARE_FUNCTION<CTX>[],
    ctx: CTX,
    startIndex = 0
): Promise<void> => {
    if (startIndex >= handlers.length) {
        return;
    }

    const currentHandler = handlers[startIndex];
    if (!currentHandler) {
        return;
    }

    await currentHandler(ctx, () => executeDispatchChain(handlers, ctx, startIndex + 1));
};
