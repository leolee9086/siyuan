import z from "zod";

const schema = z.object({
    mainMenu: z.object({
        custom: z.string(),
        default: z.string()
    }),
    commandPanel: z.object({
        custom: z.string(),
        default: z.string()
    }),
    editReadonly: z.object({
        custom: z.string(),
        default: z.string()
    }),
    syncNow: z.object({
        custom: z.string(),
        default: z.string()
    }),
    fileTree: z.object({
        custom: z.string(),
        default: z.string()
    }),
    tag: z.object({
        custom: z.string(),
        default: z.string()
    }),
    outline: z.object({
        custom: z.string(),
        default: z.string()
    }),
    bookmark: z.object({
        custom: z.string(),
        default: z.string()
    }),
    graphView: z.object({
        custom: z.string(),
        default: z.string()
    }),
    globalGraph: z.object({
        custom: z.string(),
        default: z.string()
    }),
    backlinks: z.object({
        custom: z.string(),
        default: z.string()
    }),
    conf: z.object({
        custom: z.string(),
        default: z.string()
    }),
    riff: z.object({
        custom: z.string(),
        default: z.string()
    }),
    stay: z.object({
        custom: z.string(),
        default: z.string()
    }),
    resources: z.object({
        custom: z.string(),
        default: z.string()
    }),
    item: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goBack: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goForward: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goHome: z.object({
        custom: z.string(),
        default: z.string()
    }),
    search: z.object({
        custom: z.string(),
        default: z.string()
    }),
    replace: z.object({
        custom: z.string(),
        default: z.string()
    }),
    recentDocs: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectBlock1: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectBlock2: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectBlock3: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectBlock4: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectBlock5: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectBlock6: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectBlock7: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectBlock8: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectBlock9: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectBlock0: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectLeftBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectRightBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectTopBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectBottomBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    insertLeftBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    insertRightBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    insertTopBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    insertBottomBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    copyBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    cutBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    pasteBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    createAfterBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    createBeforeBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    focusUp: z.object({
        custom: z.string(),
        default: z.string()
    }),
    focusDown: z.object({
        custom: z.string(),
        default: z.string()
    }),
    focusLeft: z.object({
        custom: z.string(),
        default: z.string()
    }),
    focusRight: z.object({
        custom: z.string(),
        default: z.string()
    }),
    toggleEdit: z.object({
        custom: z.string(),
        default: z.string()
    }),
    edit: z.object({
        custom: z.string(),
        default: z.string()
    }),
    newFile: z.object({
        custom: z.string(),
        default: z.string()
    }),
    newFileMode: z.object({
        custom: z.string(),
        default: z.string()
    }),
    save: z.object({
        custom: z.string(),
        default: z.string()
    }),
    closeTab: z.object({
        custom: z.string(),
        default: z.string()
    }),
    closeAll: z.object({
        custom: z.string(),
        default: z.string()
    }),
    closeOthers: z.object({
        custom: z.string(),
        default: z.string()
    }),
    closeLeft: z.object({
        custom: z.string(),
        default: z.string()
    }),
    closeRight: z.object({
        custom: z.string(),
        default: z.string()
    }),
    quit: z.object({
        custom: z.string(),
        default: z.string()
    }),
    redo: z.object({
        custom: z.string(),
        default: z.string()
    }),
    undo: z.object({
        custom: z.string(),
        default: z.string()
    }),
    quickMake: z.object({
        custom: z.string(),
        default: z.string()
    }),
    fullscreen: z.object({
        custom: z.string(),
        default: z.string()
    }),
    alwaysOnTop: z.object({
        custom: z.string(),
        default: z.string()
    }),
    zoomIn: z.object({
        custom: z.string(),
        default: z.string()
    }),
    zoomOut: z.object({
        custom: z.string(),
        default: z.string()
    }),
    resetZoom: z.object({
        custom: z.string(),
        default: z.string()
    }),
    help: z.object({
        custom: z.string(),
        default: z.string()
    }),
    bazaar: z.object({
        custom: z.string(),
        default: z.string()
    }),
    setting: z.object({
        custom: z.string(),
        default: z.string()
    }),
    keymap: z.object({
        custom: z.string(),
        default: z.string()
    }),
    dev: z.object({
        custom: z.string(),
        default: z.string()
    }),
    dataHistory: z.object({
        custom: z.string(),
        default: z.string()
    }),
    openNewTab: z.object({
        custom: z.string(),
        default: z.string()
    }),
    openByCurrentTab: z.object({
        custom: z.string(),
        default: z.string()
    }),
    openInNewWindow: z.object({
        custom: z.string(),
        default: z.string()
    }),
    openBy: z.object({
        custom: z.string(),
        default: z.string()
    }),
    lockScreen: z.object({
        custom: z.string(),
        default: z.string()
    }),
    export: z.object({
        custom: z.string(),
        default: z.string()
    }),
    print: z.object({
        custom: z.string(),
        default: z.string()
    }),
    share: z.object({
        custom: z.string(),
        default: z.string()
    }),
    move: z.object({
        custom: z.string(),
        default: z.string()
    }),
    copy: z.object({
        custom: z.string(),
        default: z.string()
    }),
    paste: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectAll: z.object({
        custom: z.string(),
        default: z.string()
    }),
    delete: z.object({
        custom: z.string(),
        default: z.string()
    }),
    copyPlainText: z.object({
        custom: z.string(),
        default: z.string()
    }),
    copyPlainTextLink: z.object({
        custom: z.string(),
        default: z.string()
    }),
    copyBlockRef: z.object({
        custom: z.string(),
        default: z.string()
    }),
    copyBlockEmbed: z.object({
        custom: z.string(),
        default: z.string()
    }),
    copyProtocolLink: z.object({
        custom: z.string(),
        default: z.string()
    }),
    find: z.object({
        custom: z.string(),
        default: z.string()
    }),
    findNext: z.object({
        custom: z.string(),
        default: z.string()
    }),
    findPrevious: z.object({
        custom: z.string(),
        default: z.string()
    }),

    replaceAll: z.object({
        custom: z.string(),
        default: z.string()
    }),
    toggleReadMode: z.object({
        custom: z.string(),
        default: z.string()
    }),
    editMode: z.object({
        custom: z.string(),
        default: z.string()
    }),
    splitLR: z.object({
        custom: z.string(),
        default: z.string()
    }),
    splitMove: z.object({
        custom: z.string(),
        default: z.string()
    }),
    splitTB: z.object({
        custom: z.string(),
        default: z.string()
    }),
    removeSplit: z.object({
        custom: z.string(),
        default: z.string()
    }),
    widen: z.object({
        custom: z.string(),
        default: z.string()
    }),
    narrow: z.object({
        custom: z.string(),
        default: z.string()
    }),
    enlarge: z.object({
        custom: z.string(),
        default: z.string()
    }),
    shrink: z.object({
        custom: z.string(),
        default: z.string()
    }),
    addBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    addRow: z.object({
        custom: z.string(),
        default: z.string()
    }),
    addCol: z.object({
        custom: z.string(),
        default: z.string()
    }),
    removeRow: z.object({
        custom: z.string(),
        default: z.string()
    }),
    removeCol: z.object({
        custom: z.string(),
        default: z.string()
    }),
    duplicateRow: z.object({
        custom: z.string(),
        default: z.string()
    }),
    duplicateCol: z.object({
        custom: z.string(),
        default: z.string()
    }),
    duplicateCell: z.object({
        custom: z.string(),
        default: z.string()
    }),
    moveRowUp: z.object({
        custom: z.string(),
        default: z.string()
    }),
    moveRowDown: z.object({
        custom: z.string(),
        default: z.string()
    }),
    moveColLeft: z.object({
        custom: z.string(),
        default: z.string()
    }),
    moveColRight: z.object({
        custom: z.string(),
        default: z.string()
    }),
    moveLeft: z.object({
        custom: z.string(),
        default: z.string()
    }),
    moveRight: z.object({
        custom: z.string(),
        default: z.string()
    }),
    moveUp: z.object({
        custom: z.string(),
        default: z.string()
    }),
    moveDown: z.object({
        custom: z.string(),
        default: z.string()
    }),
    moveToUp: z.object({
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
    toggleHeading: z.object({
        custom: z.string(),
        default: z.string()
    }),
    toggle1: z.object({
        custom: z.string(),
        default: z.string()
    }),
    toggle2: z.object({
        custom: z.string(),
        default: z.string()
    }),
    toggle3: z.object({
        custom: z.string(),
        default: z.string()
    }),
    toggle4: z.object({
        custom: z.string(),
        default: z.string()
    }),
    toggle5: z.object({
        custom: z.string(),
        default: z.string()
    }),
    toggle6: z.object({
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
    }),
    insertBefore: z.object({
        custom: z.string(),
        default: z.string()
    }),
    insertAfter: z.object({
        custom: z.string(),
        default: z.string()
    }),
    insert: z.object({
        custom: z.string(),
        default: z.string()
    }),
    bold: z.object({
        custom: z.string(),
        default: z.string()
    }),
    italic: z.object({
        custom: z.string(),
        default: z.string()
    }),
    underline: z.object({
        custom: z.string(),
        default: z.string()
    }),
    emphasis: z.object({
        custom: z.string(),
        default: z.string()
    }),
    mark: z.object({
        custom: z.string(),
        default: z.string()
    }),
    superscript: z.object({
        custom: z.string(),
        default: z.string()
    }),
    subscript: z.object({
        custom: z.string(),
        default: z.string()
    }),
    code: z.object({
        custom: z.string(),
        default: z.string()
    }),
    inlineCode: z.object({
        custom: z.string(),
        default: z.string()
    }),
    inlineMath: z.object({
        custom: z.string(),
        default: z.string()
    }),
    mathBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    clearInline: z.object({
        custom: z.string(),
        default: z.string()
    }),
    link: z.object({
        custom: z.string(),
        default: z.string()
    }),
    ref: z.object({
        custom: z.string(),
        default: z.string()
    }),
    blockRef: z.object({
        custom: z.string(),
        default: z.string()
    }),
    blockEmbed: z.object({
        custom: z.string(),
        default: z.string()
    }),
    a: z.object({
        custom: z.string(),
        default: z.string()
    }),
    span: z.object({
        custom: z.string(),
        default: z.string()
    }),
    img: z.object({
        custom: z.string(),
        default: z.string()
    }),
    video: z.object({
        custom: z.string(),
        default: z.string()
    }),
    audio: z.object({
        custom: z.string(),
        default: z.string()
    }),
    iframe: z.object({
        custom: z.string(),
        default: z.string()
    }),
    widget: z.object({
        custom: z.string(),
        default: z.string()
    }),
    check: z.object({
        custom: z.string(),
        default: z.string()
    }),
    list: z.object({
        custom: z.string(),
        default: z.string()
    }),
    orderedList: z.object({
        custom: z.string(),
        default: z.string()
    }),
    quote: z.object({
        custom: z.string(),
        default: z.string()
    }),
    codeBlock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    table: z.object({
        custom: z.string(),
        default: z.string()
    }),
    id: z.object({
        custom: z.string(),
        default: z.string()
    }),
    kbd: z.object({
        custom: z.string(),
        default: z.string()
    }),
    strikethrough: z.object({
        custom: z.string(),
        default: z.string()
    }),
    paragraph: z.object({
        custom: z.string(),
        default: z.string()
    }),
    document: z.object({
        custom: z.string(),
        default: z.string()
    }),
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
    alignLeft: z.object({
        custom: z.string(),
        default: z.string()
    }),
    alignCenter: z.object({
        custom: z.string(),
        default: z.string()
    }),
    alignRight: z.object({
        custom: z.string(),
        default: z.string()
    }),
    alignJustify: z.object({
        custom: z.string(),
        default: z.string()
    }),
    indentLeft: z.object({
        custom: z.string(),
        default: z.string()
    }),
    indentRight: z.object({
        custom: z.string(),
        default: z.string()
    }),
    build: z.object({
        custom: z.string(),
        default: z.string()
    }),
    preview: z.object({
        custom: z.string(),
        default: z.string()
    }),
    inbox: z.object({
        custom: z.string(),
        default: z.string()
    }),

    dailyNote: z.object({
        custom: z.string(),
        default: z.string()
    }),
    template: z.object({
        custom: z.string(),
        default: z.string()
    }),
    snippet: z.object({
        custom: z.string(),
        default: z.string()
    }),
    space: z.object({
        custom: z.string(),
        default: z.string()
    }),
    graph: z.object({
        custom: z.string(),
        default: z.string()
    }),
    reverseLink: z.object({
        custom: z.string(),
        default: z.string()
    }),
    update: z.object({
        custom: z.string(),
        default: z.string()
    }),
    commit: z.object({
        custom: z.string(),
        default: z.string()
    }),
    push: z.object({
        custom: z.string(),
        default: z.string()
    }),
    pull: z.object({
        custom: z.string(),
        default: z.string()
    }),
    fetch: z.object({
        custom: z.string(),
        default: z.string()
    }),
    checkout: z.object({
        custom: z.string(),
        default: z.string()
    }),
    branch: z.object({
        custom: z.string(),
        default: z.string()
    }),
    merge: z.object({
        custom: z.string(),
        default: z.string()
    }),
    cherryPick: z.object({
        custom: z.string(),
        default: z.string()
    }),
    revert: z.object({
        custom: z.string(),
        default: z.string()
    }),
    reset: z.object({
        custom: z.string(),
        default: z.string()
    }),
    clean: z.object({
        custom: z.string(),
        default: z.string()
    }),
    sync: z.object({
        custom: z.string(),
        default: z.string()
    }),
    cloud: z.object({
        custom: z.string(),
        default: z.string()
    }),
    account: z.object({
        custom: z.string(),
        default: z.string()
    }),
    import: z.object({
        custom: z.string(),
        default: z.string()
    }),
    backup: z.object({
        custom: z.string(),
        default: z.string()
    }),
    restore: z.object({
        custom: z.string(),
        default: z.string()
    }),
    data: z.object({
        custom: z.string(),
        default: z.string()
    }),
    history: z.object({
        custom: z.string(),
        default: z.string()
    }),
    file: z.object({
        custom: z.string(),
        default: z.string()
    }),
    asset: z.object({
        custom: z.string(),
        default: z.string()
    }),
    theme: z.object({
        custom: z.string(),
        default: z.string()
    }),
    icon: z.object({
        custom: z.string(),
        default: z.string()
    }),
    font: z.object({
        custom: z.string(),
        default: z.string()
    }),
    language: z.object({
        custom: z.string(),
        default: z.string()
    }),

    package: z.object({
        custom: z.string(),
        default: z.string()
    }),
    plugin: z.object({
        custom: z.string(),
        default: z.string()
    }),
    custom: z.object({
        custom: z.string(),
        default: z.string()
    }),
    about: z.object({
        custom: z.string(),
        default: z.string()
    }),
    feedback: z.object({
        custom: z.string(),
        default: z.string()
    }),
    sponsor: z.object({
        custom: z.string(),
        default: z.string()
    }),
    community: z.object({
        custom: z.string(),
        default: z.string()
    }),
    developer: z.object({
        custom: z.string(),
        default: z.string()
    }),
    api: z.object({
        custom: z.string(),
        default: z.string()
    }),
    changelog: z.object({
        custom: z.string(),
        default: z.string()
    }),
    license: z.object({
        custom: z.string(),
        default: z.string()
    }),
    privacy: z.object({
        custom: z.string(),
        default: z.string()
    }),
    terms: z.object({
        custom: z.string(),
        default: z.string()
    }),
    contact: z.object({
        custom: z.string(),
        default: z.string()
    }),
    tutorial: z.object({
        custom: z.string(),
        default: z.string()
    }),
    guide: z.object({
        custom: z.string(),
        default: z.string()
    }),
    faq: z.object({
        custom: z.string(),
        default: z.string()
    }),
    tips: z.object({
        custom: z.string(),
        default: z.string()
    }),
    shortcuts: z.object({
        custom: z.string(),
        default: z.string()
    }),
    release: z.object({
        custom: z.string(),
        default: z.string()
    }),
    download: z.object({
        custom: z.string(),
        default: z.string()
    }),
    install: z.object({
        custom: z.string(),
        default: z.string()
    }),
    uninstall: z.object({
        custom: z.string(),
        default: z.string()
    }),
    enable: z.object({
        custom: z.string(),
        default: z.string()
    }),
    disable: z.object({
        custom: z.string(),
        default: z.string()
    }),
    reload: z.object({
        custom: z.string(),
        default: z.string()
    }),
    restart: z.object({
        custom: z.string(),
        default: z.string()
    }),
    exit: z.object({
        custom: z.string(),
        default: z.string()
    }),
 
    enter: z.object({
        custom: z.string(),
        default: z.string()
    }),
    globalSearch: z.object({
        custom: z.string(),
        default: z.string()
    }),
    stickSearch: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goToTab1: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goToTab2: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goToTab3: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goToTab4: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goToTab5: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goToTab6: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goToTab7: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goToTab8: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goToTab9: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goToTabNext: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goToTabPrev: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goToEditTabNext: z.object({
        custom: z.string(),
        default: z.string()
    }),
    goToEditTabPrev: z.object({
        custom: z.string(),
        default: z.string()
    }),
    recentClosed: z.object({
        custom: z.string(),
        default: z.string()
    }),
    selectOpen1: z.object({
        custom: z.string(),
        default: z.string()
    }),
    toggleDock: z.object({
        custom: z.string(),
        default: z.string()
    }),
    splitMoveR: z.object({
        custom: z.string(),
        default: z.string()
    }),
    splitMoveB: z.object({
        custom: z.string(),
        default: z.string()
    }),
    closeUnmodified: z.object({
        custom: z.string(),
        default: z.string()
    }),
    tabToWindow: z.object({
        custom: z.string(),
        default: z.string()
    }),
    addToDatabase: z.object({
        custom: z.string(),
        default: z.string()
    }),
    unsplit: z.object({
        custom: z.string(),
        default: z.string()
    }),
    unsplitAll: z.object({
        custom: z.string(),
        default: z.string()
    }),
    enterBack: z.object({
        custom: z.string(),
        default: z.string()
    }),
    riffCard: z.object({
        custom: z.string(),
        default: z.string()
    }),
    config: z.object({
        custom: z.string(),
        default: z.string()
    }),
    toggleWin: z.object({
        custom: z.string(),
        default: z.string()
    })
})
export {schema as generalKeymapSchema}
const parseAsConfig = (rawConf: {}): Config.IConf["keymap"]["general"] => {
    const result = schema.safeParse(rawConf);

    if (!result.success) {
        throw new Error(`配置解析失败: ${result.error.message}`);
    }

    return result.data;
}
