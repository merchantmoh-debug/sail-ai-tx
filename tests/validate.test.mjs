import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IDS, HEADINGS, MAX_FILE_BYTES, validateReports, validateFile } from '../tools/validate.mjs';

// Synthetic format fixtures only. No medical content or final reports are generated here.
const headingText = HEADINGS.map((h) => `## ${h}`).join('\n\n') + '\n\n';
const fixture = () => IDS.map((id) => ({ id, report_markdown: headingText + 'Synthetic format fixture. '.repeat(20) }));

test('official case IDs and template heading order agree with the checker', () => {
  const cases = JSON.parse(readFileSync(new URL('../inputs/patients.json', import.meta.url), 'utf8'));
  assert.deepEqual(cases.map((c) => c.id), IDS);
  const template = readFileSync(new URL('../inputs/report_template.md', import.meta.url), 'utf8');
  assert.deepEqual([...template.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1]), HEADINGS);
});
test('valid synthetic structure passes', () => assert.deepEqual(validateReports(fixture()), []));
test('invalid wrapper and missing, duplicate or unknown IDs fail', () => {
  assert.ok(validateReports({}).length);
  assert.ok(validateReports(fixture().slice(1)).length);
  const duplicate = fixture(); duplicate[0].id = duplicate[1].id;
  assert.ok(validateReports(duplicate).length);
  const unknown = fixture(); unknown[0].id = 'AITX-OTHER';
  assert.ok(validateReports(unknown).length);
});
test('non-objects, extra fields and non-string report fail', () => {
  for (const bad of [null, [], 'text', { ...fixture()[0], extra: 1 }, { id: IDS[0], report_markdown: 1 }]) {
    const reports = fixture(); reports[0] = bad;
    assert.ok(validateReports(reports).length);
  }
});
test('missing and reordered headings fail', () => {
  const reports = fixture(); reports[0].report_markdown = reports[0].report_markdown.replace('## Summary', '## Other');
  assert.ok(validateReports(reports).length);
  reports[0].report_markdown = [...HEADINGS].reverse().map((h) => `## ${h}`).join('\n') + '\nx'.repeat(200);
  assert.ok(validateReports(reports).length);
});
test('exact UTF-16 minimum and maximum; trimming affects the minimum', () => {
  for (const [size, accepted] of [[499, false], [500, true], [300000, true], [300001, false]]) {
    const reports = fixture(); reports[0].report_markdown = headingText + 'x'.repeat(size - headingText.length);
    assert.equal(validateReports(reports).length === 0, accepted, `${size}`);
  }
  const reports = fixture(); reports[0].report_markdown = headingText + '😀'.repeat(150000);
  assert.ok(validateReports(reports).some((e) => e.includes('300000')));
  reports[0].report_markdown = ' '.repeat(1000) + headingText;
  assert.ok(validateReports(reports).some((e) => e.includes('500')));
});
test('official heading normalization is accepted', () => {
  const reports = fixture(); reports[0].report_markdown = reports[0].report_markdown.toUpperCase().replace('&', 'AND');
  assert.deepEqual(validateReports(reports), []);
});
test('active-content patterns fail; ordinary markdown links pass', () => {
  for (const bad of ['<script>', '<iframe>', '<object>', '<embed>', '<form>', '<style>', 'javascript:alert(1)', 'onclick="x"']) {
    const reports = fixture(); reports[0].report_markdown += bad;
    assert.ok(validateReports(reports).length, bad);
  }
  const reports = fixture(); reports[0].report_markdown += '\n[Source](https://example.org)';
  assert.deepEqual(validateReports(reports), []);
});
test('file extension, JSON parse, byte limit, and missing file have distinct outcomes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aitx-format-'));
  try {
    const file = join(dir, 'synthetic.json');
    writeFileSync(file, JSON.stringify(fixture()));
    assert.deepEqual(validateFile(file), []);
    assert.ok(validateFile(join(dir, 'bad.txt')).length);
    writeFileSync(file, '{'); assert.ok(validateFile(file)[0].includes('Invalid JSON'));
    writeFileSync(file, 'x'.repeat(MAX_FILE_BYTES + 1)); assert.ok(validateFile(file)[0].includes('exceeds'));
    assert.throws(() => validateFile(join(dir, 'missing.json')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
