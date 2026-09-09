export type PublicDisplaySettings = {
  birth_date_year_only: boolean;
  revision: number;
  updated_at: string;
};

export function parsePublicDisplaySettings(value: unknown): PublicDisplaySettings {
  const row = value as Partial<PublicDisplaySettings> | null;
  if (!row || typeof row.birth_date_year_only !== 'boolean'
    || !Number.isSafeInteger(row.revision) || (row.revision ?? -1) < 0
    || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))) {
    throw new Error('Invalid public display settings');
  }
  return { birth_date_year_only: row.birth_date_year_only, revision: row.revision as number, updated_at: row.updated_at };
}

export function formatPublicBirthDate(value: string | null | undefined, yearOnly: boolean): string | null {
  const date = value?.trim();
  if (!date) return null;
  if (!yearOnly) return date;
  // Stored claims normally use Gregorian ISO dates. Never fall back to the full
  // value when an unfamiliar format cannot be reduced to an unambiguous year.
  return date.match(/^\+?(\d{4})(?=$|[-/.\s年T])/u)?.[1] ?? null;
}
