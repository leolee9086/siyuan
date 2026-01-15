/**
 * Check if the block has subType property
 */
export function hasSubType(item: IBlock): item is IBlock & { subType: string } {
    return "subType" in item;
}
