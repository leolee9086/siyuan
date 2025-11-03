// 定义品牌类型
type LuteNodeID = string & { readonly _brand: unique symbol };

// 类型守卫函数
export function asLuteNodeID(id: string):  id is LuteNodeID {
    if (!/^\d{14}-[a-z0-9]{7}$/.test(id)) {
        throw new Error(`Invalid LuteNodeID: ${id}`);
    }
    return true
}
