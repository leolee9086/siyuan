
import { 切割后剩余, 过滤无效对象 } from "../src/core/types";

type State = {
    key: string;
    modifiers: {
        ctrl: boolean;
        shift: boolean;
    };
    block: {
        type: "p" | "code";
    };
};

// Split 1: ctrl is true
type Pattern1 = {
    modifiers: {
        ctrl: true;
    };
};

type Remaining1 = 切割后剩余<State, Pattern1>;

// Expect Remaining1 to be { key: string, modifiers: { ctrl: false, shift: boolean }, block: { type: "p" | "code" } }
const test1: Remaining1 = {
    key: "a",
    modifiers: { ctrl: false, shift: true },
    block: { type: "p" }
};

const test1_fail: Remaining1 = {
    key: "a",
    // @ts-expect-error
    modifiers: { ctrl: true, shift: true },
    block: { type: "p" }
};


// Split 2: block type is code (from Remaining1)
type Pattern2 = {
    block: {
        type: "code";
    };
};

type Remaining2 = 切割后剩余<Remaining1, Pattern2>;

// Expect Remaining2 to contain { block: { type: "p" } }
const test2: Remaining2 = {
    key: "a",
    modifiers: { ctrl: false, shift: true },
    block: { type: "p" }
};

const test2_fail: Remaining2 = {
    key: "a",
    modifiers: { ctrl: false, shift: true },
    // @ts-expect-error
    block: { type: "code" }
};

// Check if modifiers are still available in Remaining2
type ModifiersType = Remaining2 extends { modifiers: infer M } ? M : never;
const m: ModifiersType = { ctrl: false, shift: true };

// Check for exhaustion
type AllStates = { type: "A" | "B" };
type PatternA = { type: "A" };
type PatternB = { type: "B" };

type AfterA = 切割后剩余<AllStates, PatternA>;
type AfterB = 切割后剩余<AfterA, PatternB>;

type IsExhausted = [AfterB] extends [never] ? true : false;
const exhausted: IsExhausted = true;
