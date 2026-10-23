/** Format checks derived from https://aitxchallenge.org/models/, 2026-10-23.
 * Uses JavaScript string length to match the browser's UTF-16 limits.
 * Does not assess scientific correctness or contact the submission server.
 */
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const IDS = Object.freeze(['AITX-40001', 'AITX-40002', 'AITX-40003', 'AITX-40004']);
export const HEADINGS = Object.freeze([
  'Summary', 'Tier 1: Established Actions', 'Existing Targeted Therapies',
  'Supportive Management', 'Contraindications & Precautions',
  'Tier 2: Emerging Actions', 'Clinical Trial Eligibility',
  'Off-label or Expanded-Access Therapies', 'Tier 3: Hypothesized Actions',
  'Bespoke Therapies', 'Drug Repurposing', 'Outcome Measures & Ranking',
]);
export const MAX_FILE_BYTES = 5242880;
const ACTIVE_CONTENT = /<\s*(script|iframe|object|embed|form|style)\b|javascript\s*:|\bon[a-z]+\s*=\s*["']/i;
const normalize = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

export function validateReports(value) {
  if (!Array.isArray(value)) return ['Expected a JSON array.'];
  const errors = [];
  if (value.length !== IDS.length) errors.push('Expected exactly four reports.');
  const seen = new Set();
  for (const [index, report] of value.entries()) {
    const label = `Entry ${index + 1}`;
    if (!report || typeof report !== 'object' || Array.isArray(report)) {
      errors.push(`${label}: expected an object.`);
      continue;
    }
    if (Object.keys(report).some((k) => !['id', 'report_markdown'].includes(k))) {
      errors.push(`${label}: unexpected object field.`);
    }
    if (typeof report.id !== 'string' || !IDS.includes(report.id)) {
      errors.push(`${label}: unrecognized patient ID.`);
      continue;
    }
    if (seen.has(report.id)) errors.push(`${report.id}: duplicate patient ID.`);
    seen.add(report.id);
    const text = report.report_markdown;
    if (typeof text !== 'string') {
      errors.push(`${report.id}: report_markdown must be a string.`);
      continue;
    }
    if (text.trim().length < 500) errors.push(`${report.id}: under 500 UTF-16 units after trimming.`);
    if (text.length > 300000) errors.push(`${report.id}: over 300000 UTF-16 units.`);
    if (ACTIVE_CONTENT.test(text)) errors.push(`${report.id}: prohibited active content.`);
    const headings = text.split(/\r?\n/).flatMap((line) => {
      const match = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
      return match ? [normalize(match[1])] : [];
    });
    let cursor = 0;
    for (const required of HEADINGS) {
      const position = headings.indexOf(normalize(required), cursor);
      if (position < 0) errors.push(`${report.id}: missing or out-of-order heading: ${required}`);
      else cursor = position + 1;
    }
  }
  for (const id of IDS) if (!seen.has(id)) errors.push(`No report found for ${id}.`);
  return errors;
}

export function validateFile(path) {
  if (!/\.json$/i.test(path)) return ['Expected a .json filename.'];
  if (statSync(path).size > MAX_FILE_BYTES) return ['File exceeds 5242880 bytes.'];
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) {
    if (error instanceof SyntaxError) return [`Invalid JSON: ${error.message}`];
    throw error;
  }
  return validateReports(data);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node tools/validate.mjs <reports.json>');
    const errors = validateFile(process.argv[2]);
    console.log(JSON.stringify({ outcome: errors.length ? 'FAIL' : 'PASS', scope: 'format only', errors }, null, 2));
    process.exitCode = errors.length ? 1 : 0;
  } catch (error) {
    console.error(JSON.stringify({ outcome: 'ERROR', error: error.message }));
    process.exitCode = 2;
  }
}
