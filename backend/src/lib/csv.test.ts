import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, parseCsv } from './csv.js';

test('parseCsv supports quoted commas, escaped quotes and newlines', () => {
  assert.deepEqual(parseCsv('name,notes\r\n"Road, North","said ""done"""\r\nA,"two\nlines"\r\n'), [
    ['name', 'notes'], ['Road, North', 'said "done"'], ['A', 'two\nlines'],
  ]);
});

test('csvCell round trips special values', () => {
  const values = ['plain', 'comma,value', 'a "quote"', 'two\nlines'];
  assert.deepEqual(parseCsv(values.map(csvCell).join(','))[0], values);
});
