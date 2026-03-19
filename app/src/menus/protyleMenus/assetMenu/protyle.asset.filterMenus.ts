/**
 * 用途：构建过滤下拉菜单
 * 使用范围：Type/Size/Rating/Color 过滤按钮点击后展示菜单
 * 解耦评估：通过 imports.ts 转发菜单组件依赖，业务调用方仅关注过滤状态变更
 */
import { Menu } from "./imports";

/**
 * 展示类型过滤菜单。
 * @同步豁免: UI构建 - 下拉菜单项需要同步创建并立即响应点击事件。
 */
export const 显示类型过滤菜单 = (
    btn: Element,
    extsRef: { current: string[] },
    onFilterChanged: () => void
) => {
    const typeMenu = new Menu("asset-filter-type");
    // @内联数组
    const types = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"];

    for (const ext of types) {
        const isSelected = extsRef.current.includes(ext);
        typeMenu.addItem({
            icon: isSelected ? "iconCheck" : "",
            label: ext,
            /** @简洁函数 切换扩展名过滤并触发列表刷新 */
            click: () => {
                if (isSelected) {
                    extsRef.current = extsRef.current.filter((item) => item !== ext);
                    onFilterChanged();
                    return;
                }
                extsRef.current = [...extsRef.current, ext];
                onFilterChanged();
            }
        });
    }

    typeMenu.addSeparator();
    typeMenu.addItem({
        label: "清除过滤",
        /** @简洁函数 清空扩展名过滤并刷新列表 */
        click: () => {
            extsRef.current = [];
            onFilterChanged();
        }
    });

    const btnRect = btn.getBoundingClientRect();
    typeMenu.open({ x: btnRect.left, y: btnRect.bottom });
};

/**
 * 展示尺寸过滤菜单。
 * @同步豁免: UI构建 - 当前仅提供占位菜单，需同步展示保证交互一致。
 */
export const 显示尺寸过滤菜单 = (btn: Element) => {
    const sizeMenu = new Menu("asset-filter-size");
    // @内联数组
    const sizes = ["小 (< 500px)", "中 (500-2000px)", "大 (> 2000px)", "全部"];

    for (const size of sizes) {
        sizeMenu.addItem({
            label: size,
            /** @简洁函数 当前仅保留占位行为，后续接入尺寸过滤 */
            click: () => {
                // TODO: 实现尺寸过滤
            }
        });
    }

    const btnRect = btn.getBoundingClientRect();
    sizeMenu.open({ x: btnRect.left, y: btnRect.bottom });
};

/**
 * 展示评分过滤菜单。
 * @同步豁免: UI构建 - 当前仅提供占位菜单，需同步展示保证交互一致。
 */
export const 显示评分过滤菜单 = (btn: Element) => {
    const ratingMenu = new Menu("asset-filter-rating");
    // @内联数组
    const ratings = ["★★★★★", "★★★★☆ 以上", "★★★☆☆ 以上", "★★☆☆☆ 以上", "★☆☆☆☆ 以上", "全部"];

    for (const rating of ratings) {
        ratingMenu.addItem({
            label: rating,
            /** @简洁函数 当前仅保留占位行为，后续接入评分过滤 */
            click: () => {
                // @AIDONE: 评分过滤暂未接入后端能力，当前保持占位行为以避免误导筛选结果
            }
        });
    }

    const btnRect = btn.getBoundingClientRect();
    ratingMenu.open({ x: btnRect.left, y: btnRect.bottom });
};

/**
 * 展示颜色过滤菜单。
 * @同步豁免: UI构建 - 当前仅提供占位菜单，需同步展示保证交互一致。
 */
export const 显示颜色过滤菜单 = (btn: Element) => {
    const colorMenu = new Menu("asset-filter-color");
    colorMenu.addItem({
        label: "颜色过滤功能开发中...",
        /** @简洁函数 颜色过滤功能暂未开放，点击不执行额外动作 */
        click: () => { }
    });

    const btnRect = btn.getBoundingClientRect();
    colorMenu.open({ x: btnRect.left, y: btnRect.bottom });
};
