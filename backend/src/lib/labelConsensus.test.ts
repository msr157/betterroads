import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLabelConsensus } from './labelConsensus.js';

test('requires two independent latest reviews and preserves disagreement', () => {
  assert.deepEqual(resolveLabelConsensus(['POTHOLE_OR_DAMAGE']), { labelState: 'IN_REVIEW', exportEligible: false });
  assert.deepEqual(resolveLabelConsensus(['POTHOLE_OR_DAMAGE', 'POTHOLE_OR_DAMAGE']), { labelState: 'AGREED', exportEligible: true });
  assert.deepEqual(resolveLabelConsensus(['POTHOLE_OR_DAMAGE', 'SPEED_BREAKER']), { labelState: 'DISPUTED', exportEligible: false });
});
