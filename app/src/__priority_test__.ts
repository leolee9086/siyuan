/**
 * 优先级系统逐级披露验证测试文件
 *
 * 此文件故意包含多个优先级的 lint 错误：
 * - P0:  code-size/max-lines-per-function（函数超过 50 行）
 * - P1:  restrictions/no-else（使用 else）
 * - P2:  restrictions/no-as-assertion（使用 as 断言）
 * - P13: require-function-comment（函数缺少注释）
 *
 * 验证步骤：
 * 1. 不带 --show-all 运行 → 应只显示 P0 错误
 * 2. 带 --show-all 运行 → 应显示所有优先级的错误
 * 3. 确认 P0 清零后 P1 自动浮现，P1 清零后 P2 浮现……
 */

// P2: as 断言（优先级 2）
const x: any = 1 as any;

// P13: 缺少注释的函数
export function testFunction(a: number, b: number): number {
    // P1: 使用 else（优先级 1）
    if (a > 0) {
        return a;
    } else {
        return b;
    }
}

// P0: 超过 50 行的函数（优先级 0）
// 以下函数故意填充到超过 50 行实际代码
export function oversizedFunction(): void {
    let sum = 0;
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    for (let i = 0; i < 10; i++) { sum += i; }
    console.log(sum);
}