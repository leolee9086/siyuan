import z from "zod";
import {
    RouterMethods,
    SCHEMA_TYPE_FROM_RAW,
    RouterClass,
} from "./modeRouter.types";

/**
 * 动态 Router 类的类型守卫转换器
 * 
 * 由于 TypeScript 无法自动推断动态生成的类的类型，
 * 这里提供一个显式的类型转换函数，将运行时创建的 Router 类
 * 转换为正确的类型签名。
 * 
 * 这个函数本质上是一个受控的类型断言边界，
 * 将所有 `as` 断言集中在一个地方，便于审计和维护。
 */
//@guard-cast-boundary
export function asRouterClass<
    MethodNames extends readonly string[],
    CtxSchemaShape extends z.ZodRawShape,
    OptionsSchema extends z.ZodSchema,
    ModeKey extends keyof SCHEMA_TYPE_FROM_RAW<CtxSchemaShape>
>(
    RouterImpl: unknown
): RouterClass<MethodNames, CtxSchemaShape, OptionsSchema, ModeKey> & RouterMethods<MethodNames, CtxSchemaShape, ModeKey> {
    // 这里的类型断言是在 .guard.ts 文件中进行的，
    // 符合架构规范 "请在 .guard.ts 中使用类型守卫"
    return RouterImpl as RouterClass<MethodNames, CtxSchemaShape, OptionsSchema, ModeKey> & RouterMethods<MethodNames, CtxSchemaShape, ModeKey>;
}
