import assert from 'node:assert/strict';
import test from 'node:test';
import { profileFor, validateVehicleSelection } from './vehicleProfiles';

test('car, bike, and auto use separate immutable profile identities', () => {
  const versions = [profileFor('CAR'), profileFor('BIKE'), profileFor('AUTO_RICKSHAW')].map((p) => p.profileVersion);
  assert.equal(new Set(versions).size, 3);
});

test('bike requires a supported fixed mount and powertrain metadata', () => {
  const profile = profileFor('BIKE');
  assert.deepEqual(validateVehicleSelection(profile, 'SCOOTER', 'POCKET', {}), [
    'UNSUPPORTED_MOUNT_POSITION',
    'MISSING_METADATA_powertrain',
  ]);
  assert.deepEqual(validateVehicleSelection(profile, 'SCOOTER', 'HANDLEBAR', { powertrain: 'ICE' }), []);
});

test('other is collection-ineligible', () => {
  assert.ok(validateVehicleSelection(profileFor('OTHER'), 'OTHER', '', {}).includes('UNSUPPORTED_VEHICLE_CLASS'));
});

