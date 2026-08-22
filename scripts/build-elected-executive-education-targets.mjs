import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(repoRoot, 'data-sources', 'elected-executive-profile-gaps.json');
const outputPath = path.join(repoRoot, 'data-sources', 'elected-executive-education-targets.json');

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const targets = report.entries
  .filter((entry) => entry.missing.includes('education'))
  .map((entry) => ({
    personId: entry.personId,
    name: entry.name,
    gender: entry.profile.gender,
    party: entry.wins[0]?.party ?? entry.profile.party ?? '',
    position: entry.wins.map((win) => win.officeName).filter((value, index, all) => all.indexOf(value) === index).join('、'),
    district: entry.wins.map((win) => win.raceTitle).filter(Boolean).join('、'),
    experience: entry.profile.experience ?? '',
    missingSignals: ['education'],
  }));

fs.writeFileSync(outputPath, `${JSON.stringify({
  schemaVersion: 1,
  name: 'elected-executive-education-targets',
  generatedAt: new Date().toISOString(),
  summary: { targetCount: targets.length },
  targets,
}, null, 2)}\n`);

console.log(JSON.stringify({ outputPath, targetCount: targets.length }, null, 2));
