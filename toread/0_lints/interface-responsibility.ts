/**
 * 接口职责分离规则
 * 
 * 强制 ECS 思想：接口应该职责单一
 * - 数据接口: 只有属性 (描述数据结构)
 * - 驱动器接口: 只有方法 (描述行为契约)
 * - 混合场景: 应使用 class 实现
 */

/**
 * 判断属性签名是否为函数类型
 */
function 是函数类型属性(成员: any): boolean {
    // 检查类型注解是否为函数类型
    const 类型注解 = 成员.typeAnnotation?.typeAnnotation;
    if (!类型注解) return false;

    // TSFunctionType: () => void
    // TSCallSignatureDeclaration 不会出现在属性签名中
    return 类型注解.type === 'TSFunctionType';
}

/**
 * 分析接口成员类型
 */
function 分析接口成员(接口体成员列表: any[]): { 属性列表: any[]; 方法列表: any[] } {
    const 属性列表: any[] = [];
    const 方法列表: any[] = [];

    for (const 成员 of 接口体成员列表) {
        switch (成员.type) {
            case 'TSMethodSignature':
                // 明确的方法签名: method(): void
                方法列表.push(成员);
                break;

            case 'TSPropertySignature':
                // 属性签名，需要判断是否为函数类型
                if (是函数类型属性(成员)) {
                    方法列表.push(成员);
                } else {
                    属性列表.push(成员);
                }
                break;

            case 'TSIndexSignature':
                // 索引签名视为属性: [key: string]: any
                属性列表.push(成员);
                break;

            case 'TSCallSignatureDeclaration':
            case 'TSConstructSignatureDeclaration':
                // 调用签名和构造签名视为方法
                方法列表.push(成员);
                break;
        }
    }

    return { 属性列表, 方法列表 };
}

/**
 * 获取成员名称用于错误提示
 */
function 获取成员名称(成员: any): string {
    if (成员.key?.name) return 成员.key.name;
    if (成员.key?.value) return String(成员.key.value);
    if (成员.type === 'TSIndexSignature') return '[索引签名]';
    if (成员.type === 'TSCallSignatureDeclaration') return '()';
    if (成员.type === 'TSConstructSignatureDeclaration') return 'new()';
    return '[未知]';
}

/**
 * 接口职责分离规则插件
 */
export const 接口职责分离插件 = {
    rules: {
        '接口职责分离': {
            meta: {
                type: 'problem',
                docs: {
                    description: '禁止接口同时包含属性和方法，强制 ECS 职责分离',
                    category: 'Architecture',
                },
                schema: []
            },
            create(context: any) {
                return {
                    TSInterfaceDeclaration(node: any) {
                        const 接口名 = node.id?.name || '匿名接口';
                        const 成员列表 = node.body?.body || [];

                        if (成员列表.length === 0) return;

                        const { 属性列表, 方法列表 } = 分析接口成员(成员列表);

                        // 只有同时存在属性和方法才报错
                        if (属性列表.length > 0 && 方法列表.length > 0) {
                            const 属性名称 = 属性列表.slice(0, 3).map(获取成员名称).join(', ');
                            const 方法名称 = 方法列表.slice(0, 3).map(获取成员名称).join(', ');

                            context.report({
                                node,
                                message: `
接口职责分离违规：接口 "${接口名}" 同时包含属性和方法。
------------------------------------------------
❌ 违规原因: 项目架构要求数据与行为分离。

📦 发现的数据属性 (${属性列表.length}个): ${属性名称}${属性列表.length > 3 ? '...' : ''}
🔌 发现的行为方法 (${方法列表.length}个): ${方法名称}${方法列表.length > 3 ? '...' : ''}

🔧 重构步骤:
1. 分离类型定义:
   ① 创建纯数据接口: interface ${接口名}State { /* 只放属性 */ }
   ② 创建纯行为接口: interface ${接口名}Actions { /* 只放方法 */ }
   注意,分离后的类型定义如果只有一个属性,那么也是不被允许的,应该采用更加合适的方式来表达。

2. 若原类型被用作函数返回值 (常见于 composable):
   ❌ 错误: type Return = State & Actions  // 合并后仍是混合类型!
   ✅ 正确: interface Return { state: State; actions: Actions }  // 包装器是纯数据接口
   
   调用方修改: const { state, actions } = useXxx()
   使用时: state.xxx / actions.doSomething()

3. 若确需在单一对象中混合数据与方法 (Rich Model):
   → 改用 class 实现，文件命名为 *.class.ts
------------------------------------------------
💡 ECS 设计原则:
   - Component (组件): 纯数据接口，无方法
   - System (系统): 纯行为，操作组件数据
   - 包装器接口 { state, actions } 本身是纯数据类型，符合规范
`
                            });
                        }
                    },

                    TSTypeAliasDeclaration(node: any) {
                        const 文件名 = context.getFilename();
                        // 允许 .model.types.ts 包含混合类型
                        if (文件名.endsWith('.model.types.ts')) return;

                        const 类型名 = node.id?.name || '匿名类型';
                        const typeAnnotation = node.typeAnnotation;

                        // 只检查对象字面量类型: type Foo = { ... }
                        if (typeAnnotation.type !== 'TSTypeLiteral') return;

                        const 成员列表 = typeAnnotation.members || [];
                        if (成员列表.length === 0) return;

                        const { 属性列表, 方法列表 } = 分析接口成员(成员列表);

                        // 只有同时存在属性和方法才报错
                        if (属性列表.length > 0 && 方法列表.length > 0) {
                            const 属性名称 = 属性列表.slice(0, 3).map(获取成员名称).join(', ');
                            const 方法名称 = 方法列表.slice(0, 3).map(获取成员名称).join(', ');

                            context.report({
                                node,
                                message: `
类型职责分离违规：类型 "${类型名}" 同时包含属性和方法。
------------------------------------------------
❌ 违规原因: 项目架构要求数据与行为分离。

📦 发现的数据属性 (${属性列表.length}个): ${属性名称}${属性列表.length > 3 ? '...' : ''}
🔌 发现的行为方法 (${方法列表.length}个): ${方法名称}${方法列表.length > 3 ? '...' : ''}

🔧 重构步骤:
1. 分离类型定义:
   ① 创建纯数据类型: interface ${类型名}State { /* 只放属性 */ }
   ② 创建纯行为类型: interface ${类型名}Actions { /* 只放方法 */ }
   注意,分离后的类型定义如果只有一个属性,那么也是不被允许的,应该采用更加合适的方式来表达。

2. 若原类型是 State & Actions 的组合:
   ❌ 错误: type Return = State & Actions  // 交叉类型仍是混合!
   ✅ 正确: interface Return { state: State; actions: Actions }
   
   这个包装器本身只有两个属性 (state, actions)，是纯数据类型，符合规范。
   调用方需要从 { state, actions } 中分别解构。

⚠️ 关于 *.model.types.ts 逃生窗口:
   仅限以下场景使用:
   - 领域模型 (DDD) 中确实需要封装行为的实体
   - 不可避免的第三方库类型适配
   
   禁止用于:
   - composable 返回值 (应使用 { state, actions } 分离)
   - 普通业务类型 (应拆分为 State + Actions)
------------------------------------------------
`
                            });
                        }
                    }
                };
            }
        },

        '禁止单属性接口': {
            meta: {
                type: 'problem',
                docs: {
                    description: '禁止只有一个属性的接口，因为这种包装是冗余的',
                    category: 'Architecture',
                },
                schema: []
            },
            create(context: any) {
                return {
                    TSInterfaceDeclaration(node: any) {
                        const 接口名 = node.id?.name || '匿名接口';
                        const 成员列表 = node.body?.body || [];

                        // 只有一个成员时报错
                        if (成员列表.length === 1) {
                            const 成员 = 成员列表[0];
                            const 成员名 = 获取成员名称(成员);

                            context.report({
                                node,
                                message: `
单属性接口冗余：接口 "${接口名}" 只有一个成员 "${成员名}"。
------------------------------------------------
❌ 违规原因: 单属性接口本质上是不必要的包装。

修正方案: 
1. 直接使用原始类型 → 移除接口，在使用处直接用原类型
2. 如果是为了扩展性，添加更多属性使其有意义
------------------------------------------------
💡 设计提示:
   - 接口应该组合多个相关属性形成有意义的结构
   - 单属性包装增加了不必要的解构开销
   - 考虑是否真的需要这层抽象
`
                            });
                        }
                    },

                    TSTypeAliasDeclaration(node: any) {
                        const 类型名 = node.id?.name || '匿名类型';
                        const typeAnnotation = node.typeAnnotation;

                        // 只检查对象字面量类型: type Foo = { ... }
                        if (typeAnnotation.type !== 'TSTypeLiteral') return;

                        const 成员列表 = typeAnnotation.members || [];

                        // 只有一个成员时报错
                        if (成员列表.length === 1) {
                            const 成员 = 成员列表[0];
                            const 成员名 = 获取成员名称(成员);

                            context.report({
                                node,
                                message: `
单属性类型冗余：类型 "${类型名}" 只有一个成员 "${成员名}"。
------------------------------------------------
❌ 违规原因: 单属性类型本质上是不必要的包装。

修正方案:
1. 直接使用原始类型 → 移除类型定义，在使用处直接用原类型
2. 如果是为了扩展性，添加更多属性使其有意义
------------------------------------------------
💡 设计提示:
   - 类型应该组合多个相关属性形成有意义的结构
   - 单属性包装增加了不必要的解构开销
   - 考虑是否真的需要这层抽象
`
                            });
                        }
                    }
                };
            }
        }
    }
};

// 英文别名导出
export const interfaceResponsibilityPlugin = 接口职责分离插件;

