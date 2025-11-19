import z from "zod";
//键盘映射中的editor部分
const schema = z.object({
    general: z.object({
        ai: z.object({
            custom: z.string(),
            default: z.string()
        }),
        alignCenter: z.object({
            custom: z.string(),
            default: z.string()
        }),
        alignLeft: z.object({
            custom: z.string(),
            default: z.string()
        }),
        alignRight: z.object({
            custom: z.string(),
            default: z.string()
        }),
        attr: z.object({
            custom: z.string(),
            default: z.string()
        }),
        backlinks: z.object({
            custom: z.string(),
            default: z.string()
        }),
        collapse: z.object({
            custom: z.string(),
            default: z.string()
        }),
        copyBlockEmbed: z.object({
            custom: z.string(),
            default: z.string()
        }),
        copyBlockRef: z.object({
            custom: z.string(),
            default: z.string()
        }),
        copyHPath: z.object({
            custom: z.string(),
            default: z.string()
        }),
        copyID: z.object({
            custom: z.string(),
            default: z.string()
        }),
        copyPlainText: z.object({
            custom: z.string(),
            default: z.string()
        }),
        copyProtocol: z.object({
            custom: z.string(),
            default: z.string()
        }),
        copyProtocolInMd: z.object({
            custom: z.string(),
            default: z.string()
        }),
        copyText: z.object({
            custom: z.string(),
            default: z.string()
        }),
        duplicate: z.object({
            custom: z.string(),
            default: z.string()
        }),
        exitFocus: z.object({
            custom: z.string(),
            default: z.string()
        }),
        expand: z.object({
            custom: z.string(),
            default: z.string()
        }),
        expandDown: z.object({
            custom: z.string(),
            default: z.string()
        }),
        expandUp: z.object({
            custom: z.string(),
            default: z.string()
        }),
        fullscreen: z.object({
            custom: z.string(),
            default: z.string()
        }),
        graphView: z.object({
            custom: z.string(),
            default: z.string()
        }),
        hLayout: z.object({
            custom: z.string(),
            default: z.string()
        }),
        insertAfter: z.object({
            custom: z.string(),
            default: z.string()
        }),
        insertBefore: z.object({
            custom: z.string(),
            default: z.string()
        }),
        insertBottom: z.object({
            custom: z.string(),
            default: z.string()
        }),
        insertRight: z.object({
            custom: z.string(),
            default: z.string()
        }),
        jumpToParentNext: z.object({
            custom: z.string(),
            default: z.string()
        }),
        moveToDown: z.object({
            custom: z.string(),
            default: z.string()
        }),
        moveToUp: z.object({
            custom: z.string(),
            default: z.string()
        }),
        netAssets2LocalAssets: z.object({
            custom: z.string(),
            default: z.string()
        }),
        netImg2LocalAsset: z.object({
            custom: z.string(),
            default: z.string()
        }),
        newContentFile: z.object({
            custom: z.string(),
            default: z.string()
        }),
        newNameFile: z.object({
            custom: z.string(),
            default: z.string()
        }),
        newNameSettingFile: z.object({
            custom: z.string(),
            default: z.string()
        }),
        openBy: z.object({
            custom: z.string(),
            default: z.string()
        }),
        optimizeTypography: z.object({
            custom: z.string(),
            default: z.string()
        }),
        outline: z.object({
            custom: z.string(),
            default: z.string()
        }),
        preview: z.object({
            custom: z.string(),
            default: z.string()
        }),
        quickMakeCard: z.object({
            custom: z.string(),
            default: z.string()
        }),
        redo: z.object({
            custom: z.string(),
            default: z.string()
        }),
        refPopover: z.object({
            custom: z.string(),
            default: z.string()
        }),
        refresh: z.object({
            custom: z.string(),
            default: z.string()
        }),
        refTab: z.object({
            custom: z.string(),
            default: z.string()
        }),
        rename: z.object({
            custom: z.string(),
            default: z.string()
        }),
        showInFolder: z.object({
            custom: z.string(),
            default: z.string()
        }),
        spaceRepetition: z.object({
            custom: z.string(),
            default: z.string()
        }),
        switchReadonly: z.object({
            custom: z.string(),
            default: z.string()
        }),
        switchAdjust: z.object({
            custom: z.string(),
            default: z.string()
        }),
        undo: z.object({
            custom: z.string(),
            default: z.string()
        }),
        vLayout: z.object({
            custom: z.string(),
            default: z.string()
        }),
        wysiwyg: z.object({
            custom: z.string(),
            default: z.string()
        })
    }),
    heading: z.object({
        heading1: z.object({
            custom: z.string(),
            default: z.string()
        }),
        heading2: z.object({
            custom: z.string(),
            default: z.string()
        }),
        heading3: z.object({
            custom: z.string(),
            default: z.string()
        }),
        heading4: z.object({
            custom: z.string(),
            default: z.string()
        }),
        heading5: z.object({
            custom: z.string(),
            default: z.string()
        }),
        heading6: z.object({
            custom: z.string(),
            default: z.string()
        }),
        paragraph: z.object({
            custom: z.string(),
            default: z.string()
        })
    }),
    insert: z.object({
        appearance: z.object({
            custom: z.string(),
            default: z.string()
        }),
        bold: z.object({
            custom: z.string(),
            default: z.string()
        }),
        check: z.object({
            custom: z.string(),
            default: z.string()
        }),
        clearInline: z.object({
            custom: z.string(),
            default: z.string()
        }),
        code: z.object({
            custom: z.string(),
            default: z.string()
        }),
        "inline-code": z.object({
            custom: z.string(),
            default: z.string()
        }),
        "inline-math": z.object({
            custom: z.string(),
            default: z.string()
        }),
        italic: z.object({
            custom: z.string(),
            default: z.string()
        }),
        kbd: z.object({
            custom: z.string(),
            default: z.string()
        }),
        link: z.object({
            custom: z.string(),
            default: z.string()
        }),
        mark: z.object({
            custom: z.string(),
            default: z.string()
        }),
        strike: z.object({
            custom: z.string(),
            default: z.string()
        }),
        sub: z.object({
            custom: z.string(),
            default: z.string()
        }),
        sup: z.object({
            custom: z.string(),
            default: z.string()
        }),
        tag: z.object({
            custom: z.string(),
            default: z.string()
        }),
        underline: z.object({
            custom: z.string(),
            default: z.string()
        }),
        lastUsed: z.object({
            custom: z.string(),
            default: z.string()
        }),
        memo: z.object({
            custom: z.string(),
            default: z.string()
        }),
        ref: z.object({
            custom: z.string(),
            default: z.string()
        }),
        table: z.object({
            custom: z.string(),
            default: z.string()
        })
    }),
    list: z.object({
        checkToggle: z.object({
            custom: z.string(),
            default: z.string()
        }),
        indent: z.object({
            custom: z.string(),
            default: z.string()
        }),
        outdent: z.object({
            custom: z.string(),
            default: z.string()
        })
    }),
    table: z.object({
        "delete-column": z.object({
            custom: z.string(),
            default: z.string()
        }),
        "delete-row": z.object({
            custom: z.string(),
            default: z.string()
        }),
        insertColumnLeft: z.object({
            custom: z.string(),
            default: z.string()
        }),
        insertColumnRight: z.object({
            custom: z.string(),
            default: z.string()
        }),
        insertRowAbove: z.object({
            custom: z.string(),
            default: z.string()
        }),
        insertRowBelow: z.object({
            custom: z.string(),
            default: z.string()
        }),
        "move-column-left": z.object({
            custom: z.string(),
            default: z.string()
        }),
        "move-column-right": z.object({
            custom: z.string(),
            default: z.string()
        }),
        "move-row-down": z.object({
            custom: z.string(),
            default: z.string()
        }),
        "move-row-up": z.object({
            custom: z.string(),
            default: z.string()
        }),
        moveToDown: z.object({
            custom: z.string(),
            default: z.string()
        }),
        moveToLeft: z.object({
            custom: z.string(),
            default: z.string()
        }),
        moveToRight: z.object({
            custom: z.string(),
            default: z.string()
        }),
        moveToUp: z.object({
            custom: z.string(),
            default: z.string()
        })
    })
})
export {schema as editorKeyMapSchema}
export const parseAsConfig = (rawConf: {}): Config.IConf['keymap']['editor'] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }
    return result.data;
}
