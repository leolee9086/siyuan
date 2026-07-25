
import { calibur } from "../src/index";
import { type } from "arktype";

// Define the universe matching the test case
const 顶层分发 = calibur.universe(type({
    模式: "'编辑' | '预览'",
    块类型: "'代码' | '文本'",
    按键: "string"
}));

// Apply first split
const step1 = 顶层分发.split(
    type({ 模式: "'编辑'" }),
    (state) => 1
);

// Check step1 type
type Step1Type = typeof step1;

// Apply second split
const step2 = step1.split(
    type({ 模式: "'预览'" }),
    (state) => 2
);

// Check step2 type
type Step2Type = typeof step2;

// If Step2Type is any, we found the issue.
const isAny = (x: any) => { };
// @ts-expect-error
isAny(step2 as number); // If step2 is any, this won't error despite explicit type mismatch expectation? 
// No, checking if a type IS any is harder.

// Check if step2 has 'remain'
// type HasRemain = typeof step2.remain; 
// If step2 is ExhaustedMatcherBuilder, remain shouldn't exist.

// 尝试在耗竭的路由上调用remain,应该直接报错
// @ts-expect-error
step2.remain((state) => {
    const s = state; // Check type of s
});
