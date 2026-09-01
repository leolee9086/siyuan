/** AV 已加载条目的稳定信息契约。 */
export interface IAVItemInfo {
    itemID: string;
    groupID: string;
    previousID: string;
    item: IAVRow | IAVGalleryItem;
    primaryCell?: IAVCell;
}
