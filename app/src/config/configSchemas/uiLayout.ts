import { z } from "zod";

// 布局方向类型
const layoutDirectionSchema = z.union([z.literal("tb"), z.literal("lr")]);

// 布局类型
const layoutTypeSchema = z.union([
    z.literal("normal"),
    z.literal("center"),
    z.literal("top"),
    z.literal("bottom"),
    z.literal("left"),
    z.literal("right")
]);

// 布局面板大小
const layoutDockPanelSizeSchema = z.object({
    height: z.number().nullable(),
    width: z.number().nullable()
});

// 布局数据项
const layoutDataItemSchema = z.object({
    hotkey: z.string().default(""),
    hotkeyLangId: z.string().default(""),
    icon: z.string(),
    show: z.boolean(),
    size: layoutDockPanelSizeSchema,
    title: z.string().default(""),
    type: z.union([z.literal("pin"), z.literal("local"), z.string()])
});

// 布局面板
const layoutPanelSchema = z.object({
    data: z.array(z.array(layoutDataItemSchema)),
    pin: z.boolean()
});

// 编辑器标签页
const layoutTabEditorSchema = z.object({
    action: z.string(),
    blockId: z.string(),
    instance: z.literal("Editor"),
    mode: z.union([z.literal("wysiwyg"), z.literal("preview")]),
    notebookId: z.string(),
    rootId: z.string()
});

// 资源标签页
const layoutTabAssetSchema = z.object({
    instance: z.literal("Asset"),
    page: z.number().optional(),
    path: z.string()
});

// 反向链接标签页
const layoutTabBacklinkSchema = z.object({
    blockId: z.string(),
    instance: z.literal("Backlink"),
    rootId: z.string(),
    type: z.union([z.literal("pin"), z.literal("local")])
});

// 书签标签页
const layoutTabBookmarkSchema = z.object({
    instance: z.literal("Bookmark")
});

// 自定义标签页
const layoutTabCustomSchema = z.object({
    customModelData: z.any(),
    customModelType: z.string(),
    instance: z.literal("Custom")
});


// 搜索标签页配置
const layoutTabSearchConfigReplaceTypesSchema = z.object({
    aHref: z.boolean().optional(),
    aText: z.boolean().optional(),
    aTitle: z.boolean().optional(),
    code: z.boolean().optional(),
    codeBlock: z.boolean().optional(),
    docTitle: z.boolean().optional(),
    em: z.boolean().optional(),
    htmlBlock: z.boolean().optional(),
    imgSrc: z.boolean().optional(),
    imgText: z.boolean().optional(),
    imgTitle: z.boolean().optional(),
    inlineMath: z.boolean().optional(),
    inlineMemo: z.boolean().optional(),
    blockRef: z.boolean().optional(),
    fileAnnotationRef: z.boolean().optional(),
    kbd: z.boolean().optional(),
    mark: z.boolean().optional(),
    mathBlock: z.boolean().optional(),
    s: z.boolean().optional(),
    strong: z.boolean().optional(),
    sub: z.boolean().optional(),
    sup: z.boolean().optional(),
    tag: z.boolean().optional(),
    text: z.boolean().optional(),
    u: z.boolean().optional()
});

const layoutTabSearchConfigTypesSchema = z.object({
    audioBlock: z.boolean().optional(),
    blockquote: z.boolean().optional(),
    codeBlock: z.boolean().optional(),
    databaseBlock: z.boolean().optional(),
    document: z.boolean().optional(),
    embedBlock: z.boolean().optional(),
    heading: z.boolean().optional(),
    htmlBlock: z.boolean().optional(),
    iframeBlock: z.boolean().optional(),
    list: z.boolean().optional(),
    listItem: z.boolean().optional(),
    mathBlock: z.boolean().optional(),
    paragraph: z.boolean().optional(),
    superBlock: z.boolean().optional(),
    table: z.boolean().optional(),
    videoBlock: z.boolean().optional(),
    widgetBlock: z.boolean().optional()
});

const layoutTabSearchConfigSchema = z.object({
    query: z.string().optional(),
    group: z.number().optional(),
    hasReplace: z.boolean().optional(),
    hPath: z.string().optional(),
    idPath: z.array(z.string()).optional(),
    k: z.string().optional(),
    method: z.number().optional(),
    name: z.string().optional(),
    page: z.number().optional(),
    r: z.string().optional(),
    removed: z.boolean().optional(),
    replaceTypes: layoutTabSearchConfigReplaceTypesSchema.optional(),
    sort: z.number().optional(),
    types: layoutTabSearchConfigTypesSchema.optional()
});

const layoutTabSearchSchema = z.object({
    config: layoutTabSearchConfigSchema,
    instance: z.literal("Search")
});
// 文件树标签页
const layoutTabFilesSchema = z.object({
    instance: z.literal("Files")
});

// 图形标签页
const layoutTabGraphSchema = z.object({
    blockId: z.string(),
    instance: z.literal("Graph"),
    rootId: z.string(),
    type: z.union([z.literal("pin"), z.literal("local"), z.literal("global")])
});

// 大纲标签页
const layoutTabOutlineSchema = z.object({
    blockId: z.string(),
    instance: z.literal("Outline"),
    isPreview: z.boolean(),
    type: z.union([z.literal("pin"), z.literal("local")])
});

// 标签标签页
const layoutTabTagSchema = z.object({
    instance: z.literal("Tag")
});

const layoutTabSchema = z.object({
    active: z.boolean(),
    children: z.array(z.union([
        layoutTabAssetSchema,
        layoutTabBacklinkSchema,
        layoutTabBookmarkSchema,
        layoutTabCustomSchema,
        layoutTabEditorSchema,
        layoutTabSearchSchema,
        layoutTabFilesSchema,
        layoutTabGraphSchema,
        layoutTabOutlineSchema,
        layoutTabTagSchema
    ])),
    docIcon: z.string(),
    icon: z.string(),
    instance: z.literal("Tab"),
    lang: z.string(),
    pin: z.boolean(),
    title: z.string(),
    activeTime: z.string()
});
const layoutWndSchema = z.object({
    children: z.array(layoutTabSchema),
    height: z.string(),
    instance: z.literal("Wnd"),
    resize: layoutDirectionSchema,
    width: z.string()
});


// 使用 z.lazy() 来处理循环引用，并添加明确的类型注解
const layoutLayoutSchema: z.ZodType<Config.IUILayoutLayout> = z.object({
    children: z.array(z.lazy(() => z.union([layoutLayoutSchema, layoutWndSchema]))),
    direction: layoutDirectionSchema,
    instance: z.literal("Layout"),
    resize: layoutDirectionSchema,
    size: z.string(),
    type: layoutTypeSchema
});



const schema = z.object({
    bottom: layoutPanelSchema,
    hideDock: z.boolean(),
    layout: layoutLayoutSchema,
    left: layoutPanelSchema,
    right: layoutPanelSchema
});
export { schema as uiLayoutSchema };
// 从 schema 推断类型
type InferredUILayout = z.infer<typeof schema>;

// 然后手动对比 InferredUILayout 和 Config.IConf['uiLayout']
// 或者在 IDE 中查看类型差异
type IsCompatible = InferredUILayout extends Config.IConf["uiLayout"]
    ? Config.IConf["uiLayout"] extends InferredUILayout
    ? true
    : false
    : false;
type check = IsCompatible extends true ? true : never;

// 这个函数会在编译时验证类型兼容性
function validateTypeCompatibility(): InferredUILayout {
    return {} as Config.IConf["uiLayout"]; // 如果类型不匹配，这里会报错
}
function validateTypeCompatibilityReverse(): Config.IConf["uiLayout"] {
    return {} as InferredUILayout; // 如果类型不匹配，这里会报错
}
export const parseAsUiLayoutConfig = (rawConf: {}): Config.IConf["uiLayout"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`UI布局配置解析失败: ${result.error.message}`);
    }

    return result.data;
};