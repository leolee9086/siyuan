
import { Diff } from "../src/core/types";

// Scenario 1: Exhaustion
type T1 = {
    模式: "预览";
    块类型: "代码" | "文本";
    按键: string;
};

type U1 = {
    模式: "预览";
};

type R1 = Diff<T1, U1>;
// R1 should be never

function remain1(cb: (state: R1) => void) { }

remain1((state) => {
    // If state is never, this is fine code-wise (unreachable)
    // Does it cause implicit any error?
});

// Scenario 2: Partial overlap leading to specific Diff
type T2 = {
    A: "1" | "2";
};
type U2 = {
    A: "1";
};
type R2 = Diff<T2, U2>;
// R2 should be { A: "2" }

function remain2(cb: (state: R2) => void) { }

remain2((state) => {
    // state should be { A: "2" }
});


// Scenario 3: Something returning any?
type AnyType = any;
type R3 = Diff<T1, AnyType>;
// Expect Exclude<T1, any> -> never

type R4 = Diff<AnyType, U1>;
// Expect any extends object ? ... -> any

function remain4(cb: (state: R4) => void) { }

// If R4 is any, state is any. Implicit any error if noImplicitAny is on?
// Actually if type is explicitly any, TS usually doesn't complain about implicit any on the ARGUMENT, 
// because argument IS typed as any. implicit any is when type is not annotated and cannot be inferred.

// Wait, if R1 is 'never', inference works.
// What if R1 is unknown?
type R_Unknown = unknown;
function remain_u(cb: (state: R_Unknown) => void) { }
remain_u((state) => { }); // state is unknown. stricter than any.

// What if inference fails completely?
// e.g. some circular constraint?

