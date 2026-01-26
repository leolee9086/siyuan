# Hook 系统设计：基于指令的可扩展架构

## 💡 核心洞察

既然每个已处理的状态空间被抽象为"指令"（Command），那么我们可以为**任何一条指令**添加 Hook，实现：

- ✅ **插件系统** - 第三方扩展可以拦截和修改指令
- ✅ **日志记录** - 记录所有指令执行历史
- ✅ **性能监控** - 追踪每个指令的执行时间
- ✅ **撤销/重做** - 基于指令的 Undo/Redo 系统
- ✅ **权限控制** - 在执行前检查用户权限
- ✅ **数据同步** - 将指令同步到服务器或其他客户端

## 🏗️ 架构设计

### 1. 指令生命周期

```typescript
// 指令执行的完整生命周期
指令生成 → beforeExecute → execute → afterExecute → onSuccess/onError
   ↓           ↓              ↓          ↓              ↓
 路由决策    前置Hook      实际执行    后置Hook      结果Hook
```

### 2. Hook 类型定义

```typescript
/**
 * Hook 上下文：包含指令执行的所有信息
 */
interface HookContext<TCommand extends ListCommand> {
    // 指令信息
    command: TCommand;
    commandName: string;
    
    // 状态信息
    state: ListState;
    
    // 执行环境
    event: KeyboardEvent;
    protyle: IProtyle;
    nodeElement: HTMLElement;
    range: Range;
    
    // 元数据
    timestamp: number;
    userId?: string;
    sessionId?: string;
}

/**
 * 执行结果
 */
interface ExecutionResult {
    success: boolean;
    duration: number; // 执行时间（毫秒）
    data?: unknown;   // 执行返回的数据
}

/**
 * Hook 函数类型
 */
type BeforeHook<TCommand extends ListCommand> = (
    context: HookContext<TCommand>
) => void | Promise<void> | { skip: boolean }; // 返回 { skip: true } 可以跳过执行

type AfterHook<TCommand extends ListCommand> = (
    context: HookContext<TCommand>,
    result: ExecutionResult
) => void | Promise<void>;

type ErrorHook<TCommand extends ListCommand> = (
    context: HookContext<TCommand>,
    error: Error
) => void | Promise<void>;
```

### 3. Hook 管理器

```typescript
/**
 * Hook 管理器：注册和执行 Hook
 */
class HookManager {
    private beforeHooks: Map<ListCommand, BeforeHook<any>[]> = new Map();
    private afterHooks: Map<ListCommand, AfterHook<any>[]> = new Map();
    private errorHooks: Map<ListCommand, ErrorHook<any>[]> = new Map();
    
    // 全局 Hook（对所有指令生效）
    private globalBeforeHooks: BeforeHook<any>[] = [];
    private globalAfterHooks: AfterHook<any>[] = [];
    private globalErrorHooks: ErrorHook<any>[] = [];
    
    /**
     * 注册前置 Hook
     */
    registerBefore<TCommand extends ListCommand>(
        command: TCommand | '*',  // '*' 表示全局 Hook
        hook: BeforeHook<TCommand>
    ): () => void {
        if (command === '*') {
            this.globalBeforeHooks.push(hook);
            return () => {
                const index = this.globalBeforeHooks.indexOf(hook);
                if (index > -1) this.globalBeforeHooks.splice(index, 1);
            };
        }
        
        if (!this.beforeHooks.has(command)) {
            this.beforeHooks.set(command, []);
        }
        this.beforeHooks.get(command)!.push(hook);
        
        // 返回取消注册函数
        return () => {
            const hooks = this.beforeHooks.get(command);
            if (hooks) {
                const index = hooks.indexOf(hook);
                if (index > -1) hooks.splice(index, 1);
            }
        };
    }
    
    /**
     * 注册后置 Hook
     */
    registerAfter<TCommand extends ListCommand>(
        command: TCommand | '*',
        hook: AfterHook<TCommand>
    ): () => void {
        // 类似 registerBefore 的实现
        // ...
    }
    
    /**
     * 注册错误 Hook
     */
    registerError<TCommand extends ListCommand>(
        command: TCommand | '*',
        hook: ErrorHook<TCommand>
    ): () => void {
        // 类似 registerBefore 的实现
        // ...
    }
    
    /**
     * 执行前置 Hook
     */
    async executeBefore<TCommand extends ListCommand>(
        context: HookContext<TCommand>
    ): Promise<{ skip: boolean }> {
        // 执行全局 Hook
        for (const hook of this.globalBeforeHooks) {
            const result = await hook(context);
            if (result && typeof result === 'object' && result.skip) {
                return { skip: true };
            }
        }
        
        // 执行特定指令的 Hook
        const hooks = this.beforeHooks.get(context.command) || [];
        for (const hook of hooks) {
            const result = await hook(context);
            if (result && typeof result === 'object' && result.skip) {
                return { skip: true };
            }
        }
        
        return { skip: false };
    }
    
    /**
     * 执行后置 Hook
     */
    async executeAfter<TCommand extends ListCommand>(
        context: HookContext<TCommand>,
        result: ExecutionResult
    ): Promise<void> {
        // 执行全局 Hook
        for (const hook of this.globalAfterHooks) {
            await hook(context, result);
        }
        
        // 执行特定指令的 Hook
        const hooks = this.afterHooks.get(context.command) || [];
        for (const hook of hooks) {
            await hook(context, result);
        }
    }
    
    /**
     * 执行错误 Hook
     */
    async executeError<TCommand extends ListCommand>(
        context: HookContext<TCommand>,
        error: Error
    ): Promise<void> {
        // 执行全局 Hook
        for (const hook of this.globalErrorHooks) {
            await hook(context, error);
        }
        
        // 执行特定指令的 Hook
        const hooks = this.errorHooks.get(context.command) || [];
        for (const hook of hooks) {
            await hook(context, error);
        }
    }
}

// 全局单例
export const hookManager = new HookManager();
```

