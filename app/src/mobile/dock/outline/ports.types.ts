/**
 * Defines small structural ports shared by mobile outline behavior modules.
 * Captures the Tree operations used by outline behavior without importing its concrete class.
 * MobileOutline supplies the real Tree; another host can provide this same small API by parameter injection.
 */
export interface MobileOutlineTreeApi {
    element: HTMLElement;
    getExpandIds(): string[];
    setExpandIds(ids: string[] | null): void;
    expandAll(): void;
    collapseAll(): void;
}

/**
 * Provides the rendered outline root to behavior that traverses or binds DOM.
 * It is composed with tree and state ports instead of importing MobileOutline.
 */
export interface MobileOutlineElementPort {
    element: HTMLElement;
}

/**
 * Provides Tree operations to behavior that changes outline expansion or order.
 * It is intentionally independent from the rendered root and session state.
 */
export interface MobileOutlineTreePort {
    tree: MobileOutlineTreeApi;
}

/**
 * Identifies the document whose outline is currently rendered.
 * Async transaction and drag handlers combine it with their local capabilities.
 */
export interface MobileOutlineSessionPort {
    blockId: string;
}

/**
 * Persists the tree's current expansion state after a behavior changes it.
 * Expansion and context-menu ports compose this without requiring selection APIs.
 */
export interface MobileOutlineExpansionPersistencePort {
    saveExpendIds(): void;
}

/**
 * Updates the active heading from a node or a stable node id.
 * Transaction and focus behaviors use it without depending on tree mutation.
 */
export interface MobileOutlineSelectionPort {
    setCurrent(nodeElement: HTMLElement): void;
    setCurrentById(id: string): void;
}

/**
 * Reloads the outline and optionally runs logic after its DOM has been rebuilt.
 * Transaction handling combines it with session and selection capabilities.
 */
export interface MobileOutlineReloadPort {
    reload(callback?: () => void): void;
}

/**
 * Supports text filtering while preserving and restoring the tree expansion set.
 * It combines only the rendered root, tree state, and filter-specific snapshot.
 */
export interface MobileOutlineFilterPort extends MobileOutlineElementPort, MobileOutlineTreePort {
    preFilterExpandIds: string[] | null;
}

/**
 * Supports changing heading expansion through DOM and Tree operations.
 * It also records resulting state through the narrow persistence capability.
 */
export interface MobileOutlineExpansionPort extends MobileOutlineElementPort, MobileOutlineTreePort, MobileOutlineExpansionPersistencePort {
}

/**
 * Supports the heading context menu's session-safe mutations and expansion actions.
 * It deliberately excludes reload and filter state because those actions do not need them.
 */
export interface MobileOutlineContextMenuPort extends MobileOutlineElementPort, MobileOutlineTreePort, MobileOutlineSessionPort,
    MobileOutlineExpansionPersistencePort, MobileOutlineSelectionPort {
    isPreview: boolean;
}

/**
 * Supports document transaction handling for the current outline instance.
 * It combines identity, reload, DOM lookup, and focus restoration without menu state.
 */
export interface MobileOutlineTransactionPort extends MobileOutlineElementPort, MobileOutlineSessionPort,
    MobileOutlineReloadPort, MobileOutlineSelectionPort {
}

/**
 * Supports the toolbar action that keeps the selected heading expanded.
 * It needs only the control DOM and heading selection behavior.
 */
export interface MobileOutlineKeepCurrentExpandPort extends MobileOutlineElementPort, MobileOutlineSelectionPort {
}

/**
 * Supports mobile drag sorting within the current document outline.
 * It combines DOM, Tree scrolling, and document identity while excluding menu behavior.
 */
export interface MobileOutlineSortPort extends MobileOutlineElementPort, MobileOutlineTreePort, MobileOutlineSessionPort {
}
