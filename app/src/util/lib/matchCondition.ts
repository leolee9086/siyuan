export type MatchConditionValue = string | number | boolean | RegExp | readonly (string | number | boolean)[];
export type MatchConditions = Readonly<Record<string, unknown>>;

export interface TypedMatchResult<Payload, Result> {
    matched: true;
    handler: (payload: Payload) => Result;
    payload: Result;
}

export type TypedMatcher<Payload, Result> = (
    conditions: MatchConditions,
    payload?: Payload,
) => TypedMatchResult<Payload, Result> | undefined;

const matchesValue = (expected: MatchConditionValue, actual: unknown) => {
    if (expected instanceof RegExp) {
        return typeof actual === "string" && expected.test(actual);
    }
    if (Array.isArray(expected)) {
        return expected.some((value) => Object.is(value, actual));
    }
    return Object.is(expected, actual);
};

/** Creates a reusable condition matcher without importing host-specific values. */
export const createTypedMatcher = <Payload = void, Result = void>(
    expectedConditions: Readonly<Record<string, MatchConditionValue>>,
    handler: (payload: Payload) => Result,
): TypedMatcher<Payload, Result> => (conditions, payload) => {
    for (const [key, expected] of Object.entries(expectedConditions)) {
        if (!(key in conditions) || !matchesValue(expected, conditions[key])) {
            return undefined;
        }
    }
    return {
        matched: true,
        handler,
        payload: handler(payload as Payload),
    };
};
