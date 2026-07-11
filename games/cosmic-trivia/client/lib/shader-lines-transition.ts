export interface TriviaTransitionSnapshot {
  phase: string;
  questionId: string;
}

export function getQuestionTransitionKey(snapshot: TriviaTransitionSnapshot): string | null {
  if (
    snapshot.phase !== "between-questions" &&
    snapshot.phase !== "question-intro" &&
    snapshot.phase !== "next-question"
  ) return null;
  if (!snapshot.questionId) return null;
  return `question-transition:${snapshot.questionId}`;
}
