/**
 * Ways a signup can optionally offer to contribute to BetterRoads.
 * `value` is the stable slug stored in the DB; `label` is shown in the UI.
 * Keep this list in sync with the website's contribution dropdown.
 */
export const CONTRIBUTION_OPTIONS = [
  { value: 'road_data', label: 'Collecting road data while commuting' },
  { value: 'authority_mapping', label: 'Helping map road authorities' },
  { value: 'verification', label: 'Verifying road issues in my area' },
  { value: 'tech', label: 'Supporting tech/product improvement' },
  { value: 'research_validation', label: 'Helping with research and data validation' },
  { value: 'cloud_ai', label: 'Donating cloud / AI / infrastructure credits' },
  { value: 'funding', label: 'Supporting funding, grants, or CSR' },
  { value: 'awareness', label: 'Helping with awareness campaigns' },
  { value: 'legal_policy', label: 'Supporting legal, policy, or RTI work' },
  { value: 'govt_connect', label: 'Connecting Better Roads with government / civic authorities' },
  { value: 'unsure', label: 'I’m not sure yet, but I want to help' },
] as const;

export type ContributionValue = (typeof CONTRIBUTION_OPTIONS)[number]['value'];

/** Fast lookup set of valid contribution slugs. */
export const CONTRIBUTION_VALUES = new Set<string>(
  CONTRIBUTION_OPTIONS.map((o) => o.value),
);
