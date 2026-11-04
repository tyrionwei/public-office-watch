import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = await readFile(new URL('../src/components/CourtCandidacyNotice.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule("import React from 'react';\n" + source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext } }).outputText
  .replace("from 'react'", `from ${JSON.stringify(import.meta.resolve('react'))}`);
const { CourtCandidacyNotice } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('court notice renders temporary status, conditions and preserved history in both languages', () => {
  const zh = renderToStaticMarkup(React.createElement(CourtCandidacyNotice, { english: false }));
  const en = renderToStaticMarkup(React.createElement(CourtCandidacyNotice, { english: true }));
  assert.match(zh, /暫時處分/); assert.match(zh, /不代表資格已獲終局確定/);
  assert.match(zh, /期間及條件/); assert.match(zh, /原資格審定歷史仍保留/);
  assert.match(en, /not a final qualification judgment/); assert.match(en, /previous decisions remain/);
});
test('court context is a timeline event, not a new candidate qualification enum', async () => {
  const types = await readFile(new URL('../src/types/publicViews.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(types, /provisionally_qualified/);
  const timeline = await readFile(new URL('../src/components/CandidateLifecycle.tsx', import.meta.url), 'utf8');
  assert.match(timeline, /event.event_type === 'court_provisional_candidacy_allowed'/);
  assert.match(timeline, /法院裁定暫列候選人（非終局）/);
  assert.match(timeline, /event.source_name/);
});
