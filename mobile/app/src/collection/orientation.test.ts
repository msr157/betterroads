import assert from 'node:assert/strict';
import test from 'node:test';
import { OrientationProcessor, STANDARD_GRAVITY_MS2 } from './orientation';

function calibrate(processor: OrientationProcessor, gravity: { x: number; y: number; z: number }) {
  for (let t = 0; t <= 3_200; t += 20) processor.add(t, gravity, 0);
}

test('calibrates portrait, landscape, and tilted fixed mounts', () => {
  for (const gravity of [
    { x: 0, y: 0, z: STANDARD_GRAVITY_MS2 },
    { x: STANDARD_GRAVITY_MS2, y: 0, z: 0 },
    { x: 5.66, y: 5.66, z: 5.66 },
  ]) {
    const processor = new OrientationProcessor();
    calibrate(processor, gravity);
    assert.equal(processor.snapshot().stable, true);
  }
});

test('projects impacts onto gravity instead of device z axis', () => {
  const processor = new OrientationProcessor();
  calibrate(processor, { x: STANDARD_GRAVITY_MS2, y: 0, z: 0 });
  const sample = processor.add(3_220, { x: STANDARD_GRAVITY_MS2 + 4, y: 3, z: 0 }, 0);
  assert.ok(sample);
  assert.ok(Math.abs(sample.verticalMs2 - 4) < 0.2);
  assert.ok(Math.abs(sample.horizontalMs2 - 3) < 0.2);
});

test('does not calibrate a rotating handheld phone', () => {
  const processor = new OrientationProcessor();
  for (let t = 0; t <= 5_000; t += 20) {
    processor.add(t, { x: 0, y: 0, z: STANDARD_GRAVITY_MS2 }, 1.2);
  }
  assert.equal(processor.snapshot().stable, false);
  assert.equal(processor.snapshot().stableRatio, 0);
});

