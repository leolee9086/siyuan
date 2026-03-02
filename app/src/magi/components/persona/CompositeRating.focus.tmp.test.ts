import { describe, expect, it } from "vitest";
import { nextTick, reactive } from "vue";
import { useCompositeRatingCtx } from "./CompositeRating.ctx";

function createProps() {
  return reactive({
    questionBank: [
      { q: 1, text: "Q1", domain: "N", facet: 1, keyed: "plus" },
      { q: 2, text: "Q2", domain: "N", facet: 1, keyed: "plus" },
      { q: 26, text: "Q26", domain: "N", facet: 1, keyed: "plus" },
    ],
    subject: { id: "s", name: "n", type: "human", organization: "", role: "", careerGoal: "" },
    ipipAnswers: [],
    focusQuestionQ: null,
    focusQuestionRequestId: 0,
  });
}

describe("CompositeRating focus", () => {
  it("should jump to q on request", async () => {
    const props = createProps();
    const emit = (() => {}) as any;
    const ctx = await useCompositeRatingCtx(props as any, emit);
    expect(ctx.currentQuestionIndex.value).toBe(0);
    props.focusQuestionQ = 26;
    props.focusQuestionRequestId = 1;
    await nextTick();
    expect(ctx.currentQuestionIndex.value).toBe(2);
  });
});
