# System 1 decision engine

`DecisionEngineService` is intentionally distinct from LLM prompting. It executes deterministic Boolean (minimum GPA), Choice (study-year state), and Score (documented demonstration policy-match score) models concurrently via `Promise.all`.

The `DecisionCombiner` treats missing inputs explicitly as `NEEDS_MORE_INFORMATION`, failed conditions as `NOT_ELIGIBLE`, and all passing evaluated rules as `ELIGIBLE_SUBJECT_TO_POLICY_REVIEW`. The score is never represented as an official eligibility probability.
