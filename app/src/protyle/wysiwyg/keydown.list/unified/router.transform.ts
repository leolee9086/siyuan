/**
 * 列表转换状态空间路由。
 *
 * DOM 与快捷键事实由 state.ts 一次性收集；本模块只做可证明、无副作用的命令分发。
 */
import {LIST_COMMANDS, zodCalibur, zodState} from "./imports";

const transformHotkeys = zodState.object({
    list: zodState.boolean(),
    oList: zodState.boolean(),
    check: zodState.boolean(),
    quote: zodState.boolean(),
});

const hotkeyPatterns = {
    list: zodState.object({
        list: zodState.literal(true),
        oList: zodState.literal(false),
        check: zodState.literal(false),
        quote: zodState.literal(false),
    }),
    orderedList: zodState.object({
        list: zodState.literal(false),
        oList: zodState.literal(true),
        check: zodState.literal(false),
        quote: zodState.literal(false),
    }),
    taskList: zodState.object({
        list: zodState.literal(false),
        oList: zodState.literal(false),
        check: zodState.literal(true),
        quote: zodState.literal(false),
    }),
    quote: zodState.object({
        list: zodState.literal(false),
        oList: zodState.literal(false),
        check: zodState.literal(false),
        quote: zodState.literal(true),
    }),
} as const;

const paragraphHotkeyRouter = zodCalibur
    .universe(transformHotkeys)
    .split(hotkeyPatterns.list, () => LIST_COMMANDS.TRANSFORM_TO_UL)
    .split(hotkeyPatterns.orderedList, () => LIST_COMMANDS.TRANSFORM_TO_OL)
    .split(hotkeyPatterns.taskList, () => LIST_COMMANDS.TRANSFORM_TO_TL)
    .split(hotkeyPatterns.quote, () => LIST_COMMANDS.TRANSFORM_TO_QUOTE)
    .remain(() => LIST_COMMANDS.IGNORE)
    .build();

const headingHotkeyRouter = zodCalibur
    .universe(transformHotkeys)
    .split(hotkeyPatterns.quote, () => LIST_COMMANDS.TRANSFORM_TO_QUOTE)
    .remain(() => LIST_COMMANDS.IGNORE)
    .build();

const unorderedListHotkeyRouter = zodCalibur
    .universe(transformHotkeys)
    .split(hotkeyPatterns.orderedList, () => LIST_COMMANDS.TRANSFORM_TO_OL)
    .split(hotkeyPatterns.taskList, () => LIST_COMMANDS.TRANSFORM_TO_TL)
    .remain(() => LIST_COMMANDS.IGNORE)
    .build();

const orderedListHotkeyRouter = zodCalibur
    .universe(transformHotkeys)
    .split(hotkeyPatterns.list, () => LIST_COMMANDS.TRANSFORM_TO_UL)
    .split(hotkeyPatterns.taskList, () => LIST_COMMANDS.TRANSFORM_TO_TL)
    .remain(() => LIST_COMMANDS.IGNORE)
    .build();

const taskListHotkeyRouter = zodCalibur
    .universe(transformHotkeys)
    .split(hotkeyPatterns.list, () => LIST_COMMANDS.TRANSFORM_TO_UL)
    .split(hotkeyPatterns.orderedList, () => LIST_COMMANDS.TRANSFORM_TO_OL)
    .remain(() => LIST_COMMANDS.IGNORE)
    .build();

const listSubtypeRouter = zodCalibur
    .universe(zodState.object({
        hotkeys: transformHotkeys,
        listSubtype: zodState.union(
            zodState.enumerated("u", "o", "t"),
            zodState.literal(null),
        ),
    }))
    .split(
        zodState.object({listSubtype: zodState.literal("u")}),
        state => unorderedListHotkeyRouter(state.hotkeys),
    )
    .split(
        zodState.object({listSubtype: zodState.literal("o")}),
        state => orderedListHotkeyRouter(state.hotkeys),
    )
    .split(
        zodState.object({listSubtype: zodState.literal("t")}),
        state => taskListHotkeyRouter(state.hotkeys),
    )
    .remain(() => LIST_COMMANDS.IGNORE)
    .build();

const singleTransformSubRouter = zodCalibur
    .universe(zodState.object({
        hotkeys: transformHotkeys,
        context: zodState.object({
            blockType: zodState.enumerated("NodeParagraph", "NodeList", "NodeHeading", "other"),
            listSubtype: zodState.union(
                zodState.enumerated("u", "o", "t"),
                zodState.literal(null),
            ),
        }),
    }))
    .split(
        zodState.object({context: zodState.object({blockType: zodState.literal("NodeParagraph")})}),
        state => paragraphHotkeyRouter(state.hotkeys),
    )
    .split(
        zodState.object({context: zodState.object({blockType: zodState.literal("NodeList")})}),
        state => listSubtypeRouter({
            hotkeys: state.hotkeys,
            listSubtype: state.context.listSubtype,
        }),
    )
    .split(
        zodState.object({context: zodState.object({blockType: zodState.literal("NodeHeading")})}),
        state => headingHotkeyRouter(state.hotkeys),
    )
    .remain(() => LIST_COMMANDS.IGNORE)
    .build();

const multiTransformHotkeyRouter = zodCalibur
    .universe(transformHotkeys)
    .split(hotkeyPatterns.list, () => LIST_COMMANDS.TRANSFORM_TO_UL)
    .split(hotkeyPatterns.orderedList, () => LIST_COMMANDS.TRANSFORM_TO_OL)
    .split(hotkeyPatterns.taskList, () => LIST_COMMANDS.TRANSFORM_TO_TL)
    .split(hotkeyPatterns.quote, () => LIST_COMMANDS.TRANSFORM_TO_QUOTE)
    .remain(() => LIST_COMMANDS.IGNORE)
    .build();

const multiTransformSubRouter = zodCalibur
    .universe(zodState.object({
        hotkeys: transformHotkeys,
        selection: zodState.object({
            isContinuous: zodState.boolean(),
            hasListItem: zodState.boolean(),
        }),
    }))
    .split(
        zodState.object({selection: zodState.object({isContinuous: zodState.literal(false)})}),
        () => LIST_COMMANDS.IGNORE,
    )
    .split(
        zodState.object({selection: zodState.object({
            isContinuous: zodState.literal(true),
            hasListItem: zodState.literal(true),
        })}),
        () => LIST_COMMANDS.IGNORE,
    )
    .remain(state => multiTransformHotkeyRouter(state.hotkeys))
    .build();

/**
 * 路由结果仅描述命令，不执行 DOM 或事务副作用。
 */
export const transformSubRouter = zodCalibur
    .universe(zodState.object({
        hotkeys: transformHotkeys,
        selection: zodState.object({
            isSingle: zodState.boolean(),
            isContinuous: zodState.boolean(),
            hasListItem: zodState.boolean(),
        }),
        context: zodState.object({
            blockType: zodState.enumerated("NodeParagraph", "NodeList", "NodeHeading", "other"),
            listSubtype: zodState.union(
                zodState.enumerated("u", "o", "t"),
                zodState.literal(null),
            ),
        }),
    }))
    .split(
        zodState.object({selection: zodState.object({isSingle: zodState.literal(true)})}),
        state => singleTransformSubRouter({
            hotkeys: state.hotkeys,
            context: state.context,
        }),
    )
    .remain(state => multiTransformSubRouter({
        hotkeys: state.hotkeys,
        selection: state.selection,
    }))
    .build();
