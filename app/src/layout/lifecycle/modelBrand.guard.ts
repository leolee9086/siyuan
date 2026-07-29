/** 布局模型在挂载前允许为空；厂牌判定覆盖该完整生命周期输入域。 */
export function hasLayoutModelBrand<TBrand extends symbol, TValue extends string>(
    model: object | undefined,
    brand: TBrand,
    expected: TValue,
): model is object & Readonly<Record<TBrand, TValue>> {
    return model !== undefined && brand in model && Reflect.get(model, brand) === expected;
}
