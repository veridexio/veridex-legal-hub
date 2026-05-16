export type SourceType =
  | "government_gazette"
  | "ministry_regulation"
  | "regulator_guidance"
  | "trade_agreement"
  | "policy_document"
  | "unofficial_source";

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  government_gazette: "Government Gazette",
  ministry_regulation: "Ministry Regulation",
  regulator_guidance: "Regulator Guidance",
  trade_agreement: "Trade Agreement",
  policy_document: "Policy Document",
  unofficial_source: "Unofficial Source",
};

export const AUTHORITY_WEIGHT: Record<SourceType, number> = {
  government_gazette: 1.0,
  ministry_regulation: 0.85,
  regulator_guidance: 0.75,
  trade_agreement: 0.9,
  policy_document: 0.6,
  unofficial_source: 0.3,
};

export type AuthorityTier = "high" | "medium" | "low";

export function authorityTier(t: SourceType | null | undefined): AuthorityTier {
  const w = AUTHORITY_WEIGHT[(t ?? "unofficial_source") as SourceType];
  if (w >= 0.85) return "high";
  if (w >= 0.6) return "medium";
  return "low";
}

export type Confidence = "high" | "medium" | "low";

export function classifyConfidence(score: number): Confidence {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

export function computeConfidence(opts: {
  similarities: number[];
  authorities: (SourceType | null | undefined)[];
}): number {
  if (opts.similarities.length === 0) return 0;
  const avgSim =
    opts.similarities.reduce((a, b) => a + b, 0) / opts.similarities.length;
  const avgAuth =
    opts.authorities.length === 0
      ? 0.3
      : opts.authorities
          .map((a) => AUTHORITY_WEIGHT[(a ?? "unofficial_source") as SourceType])
          .reduce((a, b) => a + b, 0) / opts.authorities.length;
  const countBoost = Math.min(opts.similarities.length / 5, 1);
  // weighted: 55% similarity, 30% authority, 15% retrieval count
  return Math.max(0, Math.min(1, avgSim * 0.55 + avgAuth * 0.3 + countBoost * 0.15));
}