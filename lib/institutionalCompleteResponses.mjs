/**
 * Builds the complete assessment-response portion of an institutional email.
 * Called only after the server verifies completion, home-institution assignment,
 * institutional recipient and the student's disclosure authorization.
 * Includes every recorded question and response; never substitutes a top-five summary.
 */
export function formatCompleteAssessmentResponses({ questions, responses }) {
  if (!Array.isArray(questions) || !Array.isArray(responses) || !questions.length) {
    throw new Error('Complete assessment questions and responses are required');
  }
  const byId = new Map(questions.map(q => [String(q.id), q]));
  const seen = new Set();
  const rows = responses.map(r => {
    const question = byId.get(String(r.question_id));
    if (!question || seen.has(String(r.question_id))) {
      throw new Error('Assessment responses contain missing or duplicate questions');
    }
    seen.add(String(r.question_id));
    const value = r.response_value;
    if (value === null || value === undefined) {
      throw new Error('Missing assessment response');
    }
    return { number: Number(question.question_number), question: String(question.question_text || ''),
      answer: typeof value === 'string' ? value : JSON.stringify(value) };
  }).sort((a,b) => a.number - b.number);
  if (rows.length !== questions.length || rows.some(r => !Number.isInteger(r.number) ||
      !r.question.trim() || !r.answer.trim())) {
    throw new Error('Incomplete assessment response set');
  }
  return rows.map(r => `Question ${r.number}: ${r.question}\nResponse: ${r.answer}`).join('\n\n');
}
