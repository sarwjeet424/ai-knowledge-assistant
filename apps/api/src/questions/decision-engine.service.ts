import { Injectable } from '@nestjs/common';

export type DecisionStatus = 'COMPLETED' | 'MISSING_INPUT' | 'MISSING_POLICY';
export type Decision = { type: 'BOOLEAN' | 'CHOICE' | 'SCORE'; name: string; result: boolean | string | number; reason: string; status: DecisionStatus; executionTimeMs: number };
type Policy = { minimumGpa?: number; requiresSecondYear: boolean; prohibitsSportsCombination: boolean };

/** System 1: deterministic code, never a prompt, operating only on facts and retrieved evidence. */
@Injectable()
export class DecisionEngineService {
  async evaluate(question: string, evidence: string): Promise<Decision[]> {
    if (!/eligible|qualify|eligibility|can i|am i|do i meet|may i receive/i.test(question)) return [];
    const policy = this.extractPolicy(evidence);
    const facts = this.extractFacts(question);
    return Promise.all([
      this.minimumGpaModel(facts.gpa, policy.minimumGpa),
      this.studyYearModel(facts.year, policy.requiresSecondYear),
      this.sportsCombinationModel(facts.sportsScholarship, policy.prohibitsSportsCombination),
      this.policyMatchScoreModel(facts.gpa, facts.year, facts.sportsScholarship, policy),
    ]);
  }

  combine(decisions: Decision[]) {
    if (!decisions.length) return undefined;
    if (decisions.some(d => d.status === 'MISSING_INPUT')) return { result: 'NEEDS_MORE_INFORMATION', reason: 'Please provide the missing policy inputs, such as GPA and study year.' };
    if (decisions.some(d => d.status === 'MISSING_POLICY')) return { result: 'HUMAN_REVIEW_REQUIRED', reason: 'The retrieved policy does not contain enough deterministic criteria for an eligibility result.' };
    if (decisions.some(d => d.result === false || d.result === 'YEAR_REQUIREMENT_NOT_MET' || d.result === 'SPORTS_COMBINATION_NOT_ALLOWED')) return { result: 'NOT_ELIGIBLE_FOR_FULL_MERIT_SCHOLARSHIP', reason: 'At least one documented deterministic policy condition was not met.' };
    return { result: 'ELIGIBLE_SUBJECT_TO_POLICY_REVIEW', reason: 'All documented deterministic conditions evaluated as satisfied. A policy administrator remains authoritative.' };
  }

  private extractPolicy(evidence: string): Policy {
    const normalized = evidence.toLowerCase();
    const minimumGpa = normalized.match(/(?:minimum\s+)?gpa\D{0,20}(\d(?:\.\d+)?)/)?.[1];
    return { minimumGpa: minimumGpa ? Number(minimumGpa) : undefined, requiresSecondYear: /second[- ]year|year\s*2|2nd\s+year/.test(normalized), prohibitsSportsCombination: /sports scholarship.{0,80}(cannot|not|ineligible)|cannot.{0,80}sports scholarship/.test(normalized) };
  }

  private extractFacts(question: string) {
    const normalized = question.toLowerCase();
    const gpa = normalized.match(/(?:gpa|cgpa)\s*(?:of|is|:)?\s*(\d(?:\.\d+)?)/)?.[1];
    let year: number | undefined;
    if (/\b(first|1st|one)\s+year\b|\byear\s+1\b/i.test(normalized)) year = 1;
    else if (/\b(second|2nd|two)\s+year\b|\byear\s+2\b/i.test(normalized)) year = 2;
    else if (/\b(third|3rd|three)\s+year\b|\byear\s+3\b/i.test(normalized)) year = 3;
    else if (/\b(fourth|4th|four)\s+year\b|\byear\s+4\b/i.test(normalized)) year = 4;
    else {
      const match = normalized.match(/\b(?:in\s+)?(?:my\s+)?(\d+)(?:st|nd|rd|th)?\s+year\b|\byear\s+(\d+)\b/);
      if (match) year = Number(match[1] || match[2]);
    }
    return { gpa: gpa ? Number(gpa) : undefined, year, sportsScholarship: /(?:already )?(?:receive|hold|have).{0,40}sports scholarship|sports scholarship holder/.test(normalized) };
  }

  private async minimumGpaModel(gpa: number | undefined, minimum: number | undefined): Promise<Decision> { return this.timed('BOOLEAN', 'minimum_gpa', () => { if (minimum === undefined) return { result: 'UNKNOWN', reason: 'No minimum GPA rule was found in retrieved evidence.', status: 'MISSING_POLICY' as const }; if (gpa === undefined) return { result: 'UNKNOWN', reason: 'GPA was not supplied.', status: 'MISSING_INPUT' as const }; return { result: gpa >= minimum, reason: `GPA ${gpa} is ${gpa >= minimum ? 'at least' : 'below'} the documented minimum ${minimum}.`, status: 'COMPLETED' as const }; }); }
  private async studyYearModel(year: number | undefined, required: boolean): Promise<Decision> { return this.timed('CHOICE', 'study_year', () => { if (!required) return { result: 'UNKNOWN', reason: 'No study-year rule was found in retrieved evidence.', status: 'MISSING_POLICY' as const }; if (year === undefined) return { result: 'UNKNOWN', reason: 'Study year was not supplied.', status: 'MISSING_INPUT' as const }; return { result: year >= 2 ? 'ELIGIBLE_YEAR' : 'YEAR_REQUIREMENT_NOT_MET', reason: `Year ${year} evaluated against the documented second-year requirement.`, status: 'COMPLETED' as const }; }); }
  private async sportsCombinationModel(hasSports: boolean, prohibited: boolean): Promise<Decision> { return this.timed('BOOLEAN', 'sports_scholarship_combination', () => { if (!prohibited) return { result: 'UNKNOWN', reason: 'No sports-scholarship combination rule was found in retrieved evidence.', status: 'MISSING_POLICY' as const }; return { result: !hasSports, reason: hasSports ? 'Retrieved policy prohibits combining the relevant sports scholarship.' : 'No sports-scholarship conflict was supplied.', status: 'COMPLETED' as const }; }); }
  private async policyMatchScoreModel(gpa: number | undefined, year: number | undefined, hasSports: boolean, policy: Policy): Promise<Decision> { return this.timed('SCORE', 'policy_match_score', () => { if (policy.minimumGpa === undefined || !policy.requiresSecondYear || !policy.prohibitsSportsCombination) return { result: 0, reason: 'Score unavailable because retrieved evidence is missing a required policy criterion.', status: 'MISSING_POLICY' as const }; if (gpa === undefined || year === undefined) return { result: 0, reason: 'Score unavailable because GPA or study year is missing.', status: 'MISSING_INPUT' as const }; const score = Math.max(0, Math.min(100, (gpa >= policy.minimumGpa ? 45 : 0) + (year >= 2 ? 35 : 0) + (hasSports ? 0 : 20))); return { result: score, reason: 'Demonstration policy-match score, not an official eligibility probability.', status: 'COMPLETED' as const }; }); }
  private async timed(type: Decision['type'], name: string, model: () => Omit<Decision, 'type' | 'name' | 'executionTimeMs'>): Promise<Decision> { const start = performance.now(); const result = model(); return { type, name, ...result, executionTimeMs: Math.round(performance.now() - start) }; }
}
