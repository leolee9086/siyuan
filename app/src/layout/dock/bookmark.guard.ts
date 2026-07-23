/** Bookmark 属性事务中关注的最小属性集合。 */
interface IBookmarkAttrs {
    bookmark?: string;
}

/** `updateAttrs` 事务携带的书签属性前后值。 */
interface IBookmarkAttrsChange {
    old?: IBookmarkAttrs;
    new?: IBookmarkAttrs;
}

/** 编辑器页签拖放载荷的受信最小结构。 */
interface IBookmarkTabDropData {
    children: {
        instance: string;
        rootId: string;
    };
}

/** 校验可选 bookmark 属性，供事务载荷守卫复用。 */
const isBookmarkAttrs = (value: unknown): value is IBookmarkAttrs => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    return !("bookmark" in value) || value.bookmark === undefined || typeof value.bookmark === "string";
};

/** 校验 Bookmark 面板消费的 `updateAttrs` 载荷。 */
export const isBookmarkAttrsChange = (value: unknown): value is IBookmarkAttrsChange => {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const oldAttrs = "old" in value ? value.old : undefined;
    const newAttrs = "new" in value ? value.new : undefined;
    return (oldAttrs === undefined || isBookmarkAttrs(oldAttrs)) &&
        (newAttrs === undefined || isBookmarkAttrs(newAttrs));
};

/** 校验编辑器页签拖放数据，避免直接信任 JSON。 */
export const isBookmarkTabDropData = (value: unknown): value is IBookmarkTabDropData => {
    if (typeof value !== "object" || value === null || !("children" in value)) {
        return false;
    }
    const children = value.children;
    if (typeof children !== "object" || children === null || !("instance" in children) || !("rootId" in children)) {
        return false;
    }
    return typeof children.instance === "string" && typeof children.rootId === "string";
};
