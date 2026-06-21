/**
 * listRouter 命令执行器
 *
 * 本文件包含根据命令执行具体操作的执行器函数
 * 执行器负责复用现有业务逻辑，处理事件和控制器
 */

/**
 * 用途：通过同层导入网关引入任务列表定位函数，供任务勾选执行器从当前选区起点向上定位任务列表项 DOM 节点。
 * 使用范围：仅用于当前文件的任务状态切换流程，即 [`executeToggleTaskStatus()`](app/src/protyle/wysiwyg/keydown.list/executors.ts:84) 内根据 Range 起点查找 `data-subtype="t"` 的列表项；边界是这里只消费统一祖先查找能力，不在本文件内扩展 DOM 遍历策略或复写匹配规则。
 * 解耦评估：理论上可由命令路由层预先计算任务列表项后作为参数传入执行器，但当前任务定位依赖执行瞬间的 `Range.startContainer` 与真实 DOM 结构，若上移到调用方会把同一遍历职责扩散到更多入口并增加状态同步成本。事件发射也不适合这种需要同步返回节点的调用。因此继续通过同层 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/imports.ts) 转发 [`hasClosestByAttribute`](app/src/protyle/util/hasClosest.ts:73)，是在满足目录边界约束下最小化父级路径耦合的真实低耦合方案。
 */
import { hasClosestByAttribute } from "./imports";
/**
 * 用途：通过同层导入网关引入列表缩出业务函数，供列表缩出命令在单选或多选场景复用既有结构调整实现。
 * 使用范围：仅用于当前文件的 [`executeOutdent()`](app/src/protyle/wysiwyg/keydown.list/executors.ts:148)；边界是这里只触发缩出动作，不在本文件内实现列表重排算法或选择集收集逻辑。
 * 解耦评估：理论上可以把缩出动作作为参数传入执行器，但当前缩出能力本身就是列表编辑域的稳定底层操作，改为注入只会把相同依赖扩散到映射装配与测试桩层，不会降低真实耦合。事件发射同样不适合替代这种需要即时执行并依赖返回时序的编辑操作。因此通过同层 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/imports.ts) 转发 [`listOutdent()`](app/src/protyle/wysiwyg/list.ts:65) 仍是更低耦合的做法。
 */
import { listOutdent } from "./imports";
/**
 * 用途：通过同层导入网关引入列表缩进业务函数，供列表缩进命令复用既有层级调整实现。
 * 使用范围：仅用于当前文件的 [`executeIndent()`](app/src/protyle/wysiwyg/keydown.list/executors.ts:221)；边界是这里只消费缩进能力，不在本文件内重写列表层级计算或命令路由判断。
 * 解耦评估：与缩出类似，[`listIndent()`](app/src/protyle/wysiwyg/list.ts:514) 属于列表编辑域稳定底层动作；若改成依赖注入，只会把相同操作契约传播到更多装配层与测试桩，不能降低真实耦合。事件发射也不适合这种需要同步完成的编辑操作。因此通过同层 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/imports.ts) 单点转发仍是当前目录约束下更低耦合的方案。
 */
import { listIndent } from "./imports";
/**
 * 用途：通过同层导入网关引入命令执行日志函数，供缩进、缩出与类型转换执行器记录统一格式的执行结果。
 * 使用范围：仅用于当前文件的 [`executeOutdent()`](app/src/protyle/wysiwyg/keydown.list/executors.ts:148)、[`executeIndent()`](app/src/protyle/wysiwyg/keydown.list/executors.ts:221) 及各类列表转换执行器日志记录流程；边界是这里只提交日志参数，不在本文件内实现日志格式化、级别管理或输出通道。
 * 解耦评估：理论上可让调用方传入日志函数，但当前多个执行器都稳定依赖同一日志 API，若改为逐层透传，只会让映射装配层与调用入口承担重复样板，不能减少真实耦合。事件发射虽可广播日志事件，但会丢失当前同步 API 的直接调用约束并增加订阅复杂度。因此通过同层 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/imports.ts) 统一转发 [`logCommandExecution()`](app/src/util/lib/logger/core.ts:68) 更合理。
 */
import { logCommandExecution } from "./imports";
/**
 * 用途：通过同层导入网关引入任务勾选专用日志函数，供任务列表状态切换执行器记录切换前后状态。
 * 使用范围：仅用于当前文件的 [`executeToggleTaskStatus()`](app/src/protyle/wysiwyg/keydown.list/executors.ts:84)；边界是这里只上报切换日志，不在本文件内封装日志结构或实现日志输出。
 * 解耦评估：理论上可把日志函数作为参数从外部传入，但当前任务切换执行器是静态映射表中的固定处理器，注入会把依赖扩散到装配层与测试入口，而不会减少真实耦合。事件发射也不适合替代这种同步、结构固定的日志记录接口。因此经由同层 [`imports.ts`](app/src/protyle/wysiwyg/keydown.list/imports.ts) 转发 [`logTaskToggle()`](app/src/util/lib/logger/core.ts:117) 是现有架构下更低耦合的方案。
 */
import { logTaskToggle } from "./imports";
/**
 * 用途：引入列表命令常量集合，供当前执行器在构建执行器映射与记录命令日志时复用同源命令标识，避免散落字符串字面量。
 * 使用范围：用于当前文件的任务勾选、缩进、缩出、列表类型转换执行器日志记录，以及 [`executorMap`](app/src/protyle/wysiwyg/keydown.list/executors.ts:281) 的键名声明；边界是这里只消费命令常量，不负责命令判定、路由生成或命令字符串定义。
 * 解耦评估：理论上可以由调用方把命令字符串作为参数传入各执行器，但当前各执行器本身就与具体命令一一绑定，改成参数透传只会把相同常量约束扩散到更多调用点，并增加字符串失配风险。事件发射也无法替代编译期常量同源约束。因此直接从同目录 [`commands.ts`](app/src/protyle/wysiwyg/keydown.list/commands.ts) 复用 [`LIST_COMMANDS`](app/src/protyle/wysiwyg/keydown.list/commands.ts:7) 是当前模块边界内最低耦合的方案。
 */
import { LIST_COMMANDS } from "./commands";
/**
 * 用途：引入列表命令字符串联合类型，供当前执行器映射表与 [`executeCommand()`](app/src/protyle/wysiwyg/keydown.list/executors.ts:300) 的 `command` 参数保持与 [`LIST_COMMANDS`](app/src/protyle/wysiwyg/keydown.list/commands.ts) 常量同源约束。
 * 使用范围：仅用于 [`executorMap`](app/src/protyle/wysiwyg/keydown.list/executors.ts:271) 的 `Record` 键空间声明，以及 [`executeCommand()`](app/src/protyle/wysiwyg/keydown.list/executors.ts:300) 的入参类型标注；边界是这里只消费命令契约，不负责命令生成、路由判断或执行副作用。
 * 解耦评估：[`ListCommand`](app/src/protyle/wysiwyg/keydown.list/types.ts:216) 属于当前列表键盘模块的共享编译期契约，无法通过事件发射替代；若改由调用方以泛型或参数传递命令类型，只会把相同联合类型约束扩散到更多函数签名，不能降低真实耦合。继续从同目录 [`types.ts`](app/src/protyle/wysiwyg/keydown.list/types.ts) 单点复用该类型，是当前模块边界内最直接且耦合最小的方案。
 */
import type { ListCommand } from "./types";
/**
 * 用途：引入命令执行器统一函数接口，供当前文件声明各执行器实现与映射表值类型，保证所有命令处理函数遵守同一调用约定。
 * 使用范围：仅用于 [`executeToggleTaskStatus`](app/src/protyle/wysiwyg/keydown.list/executors.ts:64)、[`executeOutdent`](app/src/protyle/wysiwyg/keydown.list/executors.ts:128)、[`executeIndent`](app/src/protyle/wysiwyg/keydown.list/executors.ts:200) 等执行器常量的类型标注，以及 [`executorMap`](app/src/protyle/wysiwyg/keydown.list/executors.ts:271) 的值类型约束；边界是这里只复用接口定义，不承担控制器创建、事件绑定或路由分发。
 * 解耦评估：[`CommandExecutor`](app/src/protyle/wysiwyg/keydown.list/types.ts:238) 描述的是当前目录内所有执行器共享的静态函数签名，不能通过依赖注入或事件总线降低耦合，因为执行器本身就是被统一调度的依赖目标；若改为在本文件重复声明签名或让各函数自行推断，将造成接口定义分叉并削弱映射表的静态校验。继续复用 [`types.ts`](app/src/protyle/wysiwyg/keydown.list/types.ts) 中的单一接口定义更符合解耦目标。
 */
import type { CommandExecutor } from "./types";
/**
 * 用途：引入无序列表转换执行器，供当前执行器映射在收到对应命令时直接复用专门的转换实现。
 * 使用范围：仅用于当前文件的 [`executorMap`](app/src/protyle/wysiwyg/keydown.list/executors.ts:281) 绑定 `TRANSFORM_TO_UL` 命令；边界是这里只建立命令到执行器的静态映射，不在本文件内实现列表互转逻辑。
 * 解耦评估：理论上可由外部在运行时注册执行器，但当前列表命令集合与转换执行器是一对一的静态模块关系，强行做注册或事件分发只会增加装配复杂度并削弱静态可追踪性，不能减少真实耦合。继续从同目录直接导入专用执行器，是当前架构下更清晰的低耦合方案。
 */
import { executeTransformToUL } from "./executors.transform";
/**
 * 用途：引入有序列表转换执行器，供当前执行器映射在收到对应命令时复用既有转换实现。
 * 使用范围：仅用于当前文件的 [`executorMap`](app/src/protyle/wysiwyg/keydown.list/executors.ts:281) 绑定 `TRANSFORM_TO_OL` 命令；边界是这里只进行静态映射，不承担有序列表转换细节。
 * 解耦评估：与无序列表转换相同，理论上的注册式注入会把静态映射关系变成额外装配复杂度，而不会减少执行器与命令之间本已存在的一对一关系。直接从同目录导入专用执行器更符合当前模块边界。
 */
import { executeTransformToOL } from "./executors.transform";
/**
 * 用途：引入任务列表转换执行器，供当前执行器映射在收到对应命令时复用既有转换实现。
 * 使用范围：仅用于当前文件的 [`executorMap`](app/src/protyle/wysiwyg/keydown.list/executors.ts:281) 绑定 `TRANSFORM_TO_TL` 命令；边界是这里只负责映射，不承担任务列表转换细节。
 * 解耦评估：理论上可通过参数传递在外部装配，但当前执行器映射本身就是该模块的静态契约，改为注入只会增加调用路径样板，不能降低真实耦合。直接导入专用执行器仍是更低耦合的方案。
 */
import { executeTransformToTL } from "./executors.transform";
/**
 * 用途：引入引述块转换执行器，供当前执行器映射在收到对应命令时复用既有转换实现。
 * 使用范围：仅用于当前文件的 [`executorMap`](app/src/protyle/wysiwyg/keydown.list/executors.ts:281) 绑定 `TRANSFORM_TO_QUOTE` 命令；边界是这里只建立命令绑定，不在本文件内实现引述转换逻辑。
 * 解耦评估：理论上可通过事件或注册表间接选择执行器，但当前命令和执行器的关系是静态且稳定的，引入额外中间层只会增加复杂度并削弱类型可追踪性，无法减少真实耦合。直接从同目录导入专用执行器是当前模块内更合适的方案。
 */
import { executeTransformToQuote } from "./executors.transform";
import { toggleTaskListItem } from "./imports";

/**
 * 执行任务列表切换命令（Phase 1）
 *
 * 用途：切换任务列表项的完成状态
 * 使用场景：当路由器返回 CHECK_TOGGLE 命令时调用
 *
 * 实现逻辑：
 * 1. 查找光标所在的任务列表项元素
 * 2. 保存原始 HTML 用于事务回滚
 * 3. 切换任务状态（已完成 <-> 未完成）
 * 4. 更新图标和 CSS 类
 * 5. 更新时间戳
 * 6. 提交事务
 * 7. 记录详细日志
 * 8. 阻止事件传播并中止后续处理
 */
const executeToggleTaskStatus: CommandExecutor = async (
    event, protyle, nodeElement, range, controller, state
) => {
    const taskItemElement = hasClosestByAttribute(range.startContainer, "data-subtype", "t");
    
    if (!taskItemElement) {
        return;
    }
    
    const useElement = taskItemElement.querySelector("use");
    if (!useElement) {
        return;
    }

    const { taskStatus, nextTaskStatus } = state.context;
    if (taskStatus === null || nextTaskStatus === null) {
        return;
    }

    toggleTaskListItem(protyle, taskItemElement);
    
    // 记录详细的执行日志
    logTaskToggle(
        {
            command: LIST_COMMANDS.CHECK_TOGGLE,
            event,
            nodeElement: taskItemElement,
        },
        taskStatus === "done",
        nextTaskStatus === "done"
    );
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("任务列表状态切换操作");
};

/**
 * 执行列表缩出命令（Phase 2）
 *
 * 用途：减少列表项的缩进层级
 * 使用场景：当路由器返回 OUTDENT 命令时调用
 *
 * 实现逻辑：
 * 1. 检查是否有多选元素
 * 2. 如果有多选，使用多选元素执行缩出
 * 3. 如果无多选，使用当前元素的父列表项执行缩出
 * 4. 调用现有的 listOutdent 业务逻辑
 * 5. 记录详细日志
 * 6. 阻止事件传播并中止后续处理
 */
const executeOutdent: CommandExecutor = async (
    event, protyle, nodeElement, range, controller
) => {
    const selectElements = protyle.wysiwyg?.element.querySelectorAll(".protyle-wysiwyg--select");
    
    // 场景 1: 有多选元素，使用多选元素执行缩出
    if (selectElements && selectElements.length > 0) {
        const elementsArray: HTMLElement[] = [];
        for (let i = 0; i < selectElements.length; i++) {
            const element = selectElements[i];
            // querySelectorAll 返回的是 Element 类型，需要确保是 HTMLElement 才能传递给 listOutdent
            // 这个检查过滤掉可能的 SVGElement 等非 HTML 元素
            if (element instanceof HTMLElement) {
                elementsArray.push(element);
            }
        }
        
        listOutdent(protyle, elementsArray, range);
        
        logCommandExecution({
            command: LIST_COMMANDS.OUTDENT,
            event,
            nodeElement,
            result: `多选缩出: ${elementsArray.length} 个元素`,
            context: {
                selectCount: elementsArray.length
            }
        });
        
        event.preventDefault();
        event.stopPropagation();
        controller.abort("列表缩出操作");
        return;
    }
    
    // 场景 2: 无多选，使用当前元素的父列表项
    const parentLi = nodeElement.parentElement;
    if (!parentLi) {
        return;
    }
    
    listOutdent(protyle, [parentLi], range);
    
    logCommandExecution({
        command: LIST_COMMANDS.OUTDENT,
        event,
        nodeElement,
        result: "单个元素缩出",
        context: {
            parentId: parentLi.getAttribute("data-node-id")
        }
    });
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("列表缩出操作");
};

/**
 * 执行列表缩进命令（Phase 3）
 *
 * 用途：增加列表项的缩进层级
 * 使用场景：当路由器返回 INDENT 命令时调用
 *
 * 实现逻辑：
 * 1. 检查是否有多选元素
 * 2. 如果有多选，使用多选元素执行缩进
 * 3. 如果无多选，使用当前元素的父列表项执行缩进
 * 4. 调用现有的 listIndent 业务逻辑
 * 5. 记录详细日志
 * 6. 阻止事件传播并中止后续处理
 */
const executeIndent: CommandExecutor = async (
    event, protyle, nodeElement, range, controller
) => {
    const selectElements = protyle.wysiwyg?.element.querySelectorAll(".protyle-wysiwyg--select");
    
    // 场景 1: 有多选元素，使用多选元素执行缩进
    if (selectElements && selectElements.length > 0) {
        const elementsArray: HTMLElement[] = [];
        for (let i = 0; i < selectElements.length; i++) {
            const element = selectElements[i];
            // querySelectorAll 返回的是 Element 类型，需要确保是 HTMLElement 才能传递给 listIndent
            // 这个检查过滤掉可能的 SVGElement 等非 HTML 元素
            if (element instanceof HTMLElement) {
                elementsArray.push(element);
            }
        }
        
        listIndent(protyle, elementsArray, range);
        
        logCommandExecution({
            command: LIST_COMMANDS.INDENT,
            event,
            nodeElement,
            result: `多选缩进: ${elementsArray.length} 个元素`,
            context: {
                selectCount: elementsArray.length
            }
        });
        
        event.preventDefault();
        event.stopPropagation();
        controller.abort("列表缩进操作");
        return;
    }
    
    // 场景 2: 无多选，使用当前元素的父列表项
    const parentLi = nodeElement.parentElement;
    if (!parentLi) {
        return;
    }
    
    listIndent(protyle, [parentLi], range);
    
    logCommandExecution({
        command: LIST_COMMANDS.INDENT,
        event,
        nodeElement,
        result: "单个元素缩进",
        context: {
            parentId: parentLi.getAttribute("data-node-id")
        }
    });
    
    event.preventDefault();
    event.stopPropagation();
    controller.abort("列表缩进操作");
};

/**
 * 命令执行器映射表
 *
 * 用途：将命令映射到对应的执行器函数
 * 使用场景：在 executeCommand 函数中根据命令查找执行器
 *
 * Phase 1-4 已实现：
 * - CHECK_TOGGLE: executeToggleTaskStatus (Phase 1)
 * - OUTDENT: executeOutdent (Phase 2)
 * - INDENT: executeIndent (Phase 3)
 * - TRANSFORM_TO_*: executeTransformTo* (Phase 4)
 * - IGNORE: null（不需要执行器）
 */
const executorMap: Record<ListCommand, CommandExecutor | null> = {
    [LIST_COMMANDS.CHECK_TOGGLE]: executeToggleTaskStatus,
    [LIST_COMMANDS.OUTDENT]: executeOutdent,
    [LIST_COMMANDS.INDENT]: executeIndent,
    [LIST_COMMANDS.TRANSFORM_TO_UL]: executeTransformToUL,
    [LIST_COMMANDS.TRANSFORM_TO_OL]: executeTransformToOL,
    [LIST_COMMANDS.TRANSFORM_TO_TL]: executeTransformToTL,
    [LIST_COMMANDS.TRANSFORM_TO_QUOTE]: executeTransformToQuote,
    [LIST_COMMANDS.IGNORE]: null
};

/**
 * 执行命令
 *
 * 用途：根据命令类型执行对应的操作
 * 使用场景：在中间件中调用，执行路由器返回的命令
 *
 * @param command - 要执行的命令
 * @param event - 键盘事件对象
 * @param protyle - Protyle 编辑器实例
 * @param nodeElement - 当前节点元素
 * @param range - 当前选区对象
 * @param controller - 中止控制器
 *
 * 实现逻辑：
 * 1. 从映射表中查找命令对应的执行器
 * 2. 如果执行器存在，则调用执行器
 * 3. 如果执行器不存在（如 IGNORE 命令），则不执行任何操作
 */
export const executeCommand = async (command: ListCommand,
    event: KeyboardEvent, protyle: IProtyle, nodeElement: HTMLElement,
    range: Range, controller: AbortController, state: Parameters<CommandExecutor>[5]) => {
    const executor = executorMap[command];
    
    if (executor) {
        await executor(event, protyle, nodeElement, range, controller, state);
    }
    // IGNORE 命令或未实现的命令不执行任何操作
};
