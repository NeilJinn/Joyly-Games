import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShaderLinesTransition from "../components/ShaderLinesTransition";

describe("ShaderLinesTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("completes a reduced-motion run once", () => {
    const onComplete = vi.fn();
    render(
      <ShaderLinesTransition
        active
        runKey="question-intro:q-1"
        reducedMotion
        onComplete={onComplete}
        durationMs={120}
      />,
    );

    expect(document.querySelector("[data-testid=shader-lines-transition]")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(120));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("starts a new run only when runKey changes", () => {
    const onComplete = vi.fn();
    const view = render(
      <ShaderLinesTransition
        active
        runKey="question-intro:q-1"
        reducedMotion
        onComplete={onComplete}
        durationMs={100}
      />,
    );

    act(() => vi.advanceTimersByTime(100));
    expect(onComplete).toHaveBeenCalledTimes(1);

    view.rerender(
      <ShaderLinesTransition
        active
        runKey="question-intro:q-1"
        reducedMotion
        onComplete={onComplete}
        durationMs={100}
      />,
    );
    act(() => vi.advanceTimersByTime(100));
    expect(onComplete).toHaveBeenCalledTimes(1);

    view.rerender(
      <ShaderLinesTransition
        active
        runKey="question-intro:q-2"
        reducedMotion
        onComplete={onComplete}
        durationMs={100}
      />,
    );
    act(() => vi.advanceTimersByTime(100));
    expect(onComplete).toHaveBeenCalledTimes(2);
  });
});
