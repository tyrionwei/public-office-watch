import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../../../src/i18n';
import { InternalUpdateAdminPage } from '../../../src/pages/InternalUpdateAdminPage';
import { PersonPage } from '../../../src/pages/PersonPage';
import '../../../src/index.css';

const profile = Object.freeze({
  person: { person_id: 'synthetic-person', name: '同名比對測試人物', party: '無黨籍', status: 'other',
    gender: 'unknown', role_label: '公開人物', position: '測試人物', primary_photo_url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>',
    education: [], experience: [], updated_at: '2026-09-09T00:00:00Z' },
  candidate_records: [], party_affiliations: [], identity_records: [],
  public_claims: [Object.freeze({ claim_id: 'synthetic-birthday', person_id: 'synthetic-person', claim_type: 'birth_date',
    claim_value: '1981-07-23', claim_json: {}, source_name: '合成測試來源', source_url: 'https://example.test/source',
    confidence_level: 'A', updated_at: '2026-09-09T00:00:00Z' })],
});
window.__birthdayProfile = profile;
const route = new URLSearchParams(location.search).get('page') === 'admin' ? '/internal/update-admin' : '/people/synthetic-person';
createRoot(document.getElementById('root')).render(<LanguageProvider><MemoryRouter initialEntries={[route]}>
  <Routes><Route path="/internal/update-admin" element={<InternalUpdateAdminPage />} /><Route path="/people/:personId" element={<PersonPage />} /></Routes>
</MemoryRouter></LanguageProvider>);
