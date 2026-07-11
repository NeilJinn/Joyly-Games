import { describe, expect, it } from "vitest";
import { getQuestionTransitionKey } from "../lib/shader-lines-transition";

describe("getQuestionTransitionKey", () => {
  it("ignores phases that are not question transitions", () => {
    expect(getQuestionTransitionKey({ phase: "answering", questionId: "q-1" })).toBeNull();
  });

  it("returns a stable key for a question intro", () => {
    const snapshot = { phase: "question-intro", questionId: "q-1" } as const;
    expect(getQuestionTransitionKey(snapshot)).toBe("question-intro:q-1");
    expect(getQuestionTransitionKey(snapshot)).toBe(getQuestionTransitionKey(snapshot));
  });

  it("changes when the question id changes", () => {
    expect(getQuestionTransitionKey({ phase: "next-question", questionId: "q-1" }))
      .not.toBe(getQuestionTransitionKey({ phase: "next-question", questionId: "q-2" }));
  });

  it("requires a question id", () => {
    expect(getQuestionTransitionKey({ phase: "question-intro", questionId: "" })).toBeNull();
  });
});
