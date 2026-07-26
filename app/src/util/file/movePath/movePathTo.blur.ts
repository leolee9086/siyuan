import {setStorageVal} from "./imports";
import {Constants} from "./imports";
import {getSiyuanConfig} from "./imports";
import {getSiyuanStorage} from "./imports";

/**
 * 创建输入框失焦事件处理器
 * 保存搜索历史到本地存储
 */
export const 创建失焦事件处理器 = (inputElement: HTMLInputElement) => {
    return () => {
        const storage = getSiyuanStorage();
        const config = getSiyuanConfig();
        const movePathStorage = storage[Constants.LOCAL_MOVE_PATH];
        if (inputElement.value) {
            let list: string[] = movePathStorage.keys;
            list.splice(0, 0, inputElement.value);
            list = Array.from(new Set(list)).slice(0, config.search.limit);
            movePathStorage.keys = list;
        }
        movePathStorage.k = inputElement.value;
        setStorageVal(Constants.LOCAL_MOVE_PATH, movePathStorage);
    };
};
