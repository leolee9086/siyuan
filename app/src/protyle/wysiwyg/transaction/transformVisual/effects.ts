/** 用途：读取转换后的内容渲染器。使用范围：事务转换视觉刷新。解耦评估：从同域网关读取，命令层不加载渲染器。 */
import {contentRendererRegistry} from "./imports";
/** 用途：读取属性视图渲染函数。使用范围：事务转换视觉刷新。解耦评估：从同域网关读取，命令层不加载 AV。 */
import {avRender} from "./imports";
/** 用途：读取块级渲染函数。使用范围：事务转换视觉刷新。解耦评估：从同域网关读取，命令层不加载块渲染。 */
import {blockRender} from "./imports";
/** 用途：读取高亮渲染函数。使用范围：事务转换视觉刷新。解耦评估：从同域网关读取，命令层不加载高亮模块。 */
import {highlightRender} from "./imports";
/** 用途：读取事务回放函数。使用范围：非视图折叠的列表转换。解耦评估：从同域网关读取，端口只保存函数引用。 */
import {onTransaction} from "./imports";
/** 用途：注册转换视觉端口。使用范围：Protyle 启动阶段。解耦评估：端口定义保持无渲染依赖。 */
import {setTransactionTransformVisualEffects} from "./port";

/** 作用：执行转换后的完整块渲染。意图：让低层转换命令不直接依赖 AV 或内容渲染器。调用时机：转换提交完成后。 */
const rerenderTransactionTransforms = (protyle: IProtyle) => {
    blockRender(protyle, protyle.wysiwyg.element);
    contentRendererRegistry.renderBatch(protyle.wysiwyg.element);
    highlightRender(protyle.wysiwyg.element);
    avRender(protyle.wysiwyg.element, protyle);
};

/** 作用：按旧转换事务的顺序刷新已替换块。意图：保留普通段落和标题转换的渲染时序。调用时机：turnsIntoTransaction 和 turnsOneInto 提交后。 */
const renderConvertedBlocks = (protyle: IProtyle) => {
    contentRendererRegistry.renderBatch(protyle.wysiwyg.element);
    highlightRender(protyle.wysiwyg.element);
    avRender(protyle.wysiwyg.element, protyle);
    blockRender(protyle, protyle.wysiwyg.element);
};

setTransactionTransformVisualEffects({
    applyOperations: onTransaction,
    rerender: rerenderTransactionTransforms,
    renderBlock: blockRender,
    renderConvertedBlocks,
});
