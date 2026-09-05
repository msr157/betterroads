export type LabelConsensus = { labelState: 'IN_REVIEW' | 'AGREED' | 'DISPUTED'; exportEligible: boolean };

/** Receives one latest label per distinct reviewer. */
export function resolveLabelConsensus(latestLabels: string[]): LabelConsensus {
  if (latestLabels.length < 2) return { labelState: 'IN_REVIEW', exportEligible: false };
  const agreed = new Set(latestLabels).size === 1;
  return { labelState: agreed ? 'AGREED' : 'DISPUTED', exportEligible: agreed };
}
