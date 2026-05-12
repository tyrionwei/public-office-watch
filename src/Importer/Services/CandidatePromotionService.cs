using Npgsql;
using PublicOfficialInterest.Importer.Models;

namespace PublicOfficialInterest.Importer.Services;

public sealed class CandidatePromotionService
{
    private readonly string _connectionString;
    private readonly CandidatePromotionValidator _validator;

    public CandidatePromotionService(string connectionString, CandidatePromotionValidator validator)
    {
        _connectionString = connectionString;
        _validator = validator;
    }

    public async Task<PromotionResult> DryRunAsync(Guid candidateId, CancellationToken cancellationToken = default)
    {
        var candidate = await LoadCandidateAsync(candidateId, cancellationToken)
            ?? throw new InvalidOperationException("candidate not found");

        var result = BuildDryRunResult(candidate);
        PrintDryRunSummary(result);
        return result;
    }

    public async Task<PromotionResult> PromoteAsync(Guid candidateId, CancellationToken cancellationToken = default)
    {
        var candidate = await LoadCandidateAsync(candidateId, cancellationToken)
            ?? throw new InvalidOperationException("candidate not found");

        var preview = BuildDryRunResult(candidate);
        if (!preview.CanPromote)
        {
            Console.WriteLine("mode: promote execute");
            Console.WriteLine("transaction rolled back");
            Console.WriteLine($"failed reason: {preview.FailureReason}");
            throw new InvalidOperationException(preview.FailureReason);
        }

        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            var result = preview;
            result.IsDryRun = false;
            result.Success = false;

            var person = await GetOrCreatePersonAsync(connection, transaction, candidate, cancellationToken);
            result.PersonId = person.Id;
            result.PersonCreated = person.Created;

            var company = await GetOrCreateCompanyAsync(connection, transaction, candidate, cancellationToken);
            result.CompanyId = company.Id;
            result.CompanyCreated = company.Created;

            var sourceDocument = await GetOrCreateSourceDocumentAsync(connection, transaction, candidate, cancellationToken);
            result.SourceDocumentId = sourceDocument.Id;
            result.SourceDocumentCreated = sourceDocument.Created;

            var relation = await GetOrCreateRelationAsync(connection, transaction, candidate, person.Id, company.Id, sourceDocument.Id, cancellationToken);
            result.RelationId = relation.Id;
            result.RelationCreated = relation.Created;

            await UpdateCandidateStatusAsync(connection, transaction, candidate.Id, relation.Id, cancellationToken);
            result.CandidateStatusUpdate = "review_status updated to verified";

            await transaction.CommitAsync(cancellationToken);
            result.Success = true;
            result.TransactionCommitted = true;

            PrintExecuteSummary(result);
            return result;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            Console.WriteLine("mode: promote execute");
            Console.WriteLine("transaction rolled back");
            throw;
        }
    }

    private PromotionResult BuildDryRunResult(RelationCandidateRecord candidate)
    {
        var (isValid, errors, riskScan) = _validator.Validate(candidate);
        var result = new PromotionResult
        {
            Success = isValid,
            IsDryRun = true,
            CanPromote = isValid,
            FailureReason = string.Join("; ", errors),
            CandidateId = candidate.Id,
            PersonName = candidate.PersonName,
            CompanyName = candidate.CompanyName,
            UnifiedBusinessNo = candidate.UnifiedBusinessNo,
            GuessedRelationType = candidate.GuessedRelationType,
            ConfidenceSuggestion = candidate.ConfidenceSuggestion,
            SourceName = FirstNonEmpty(candidate.SourceName, "(missing)"),
            SourceUrl = FirstNonEmpty(candidate.SourceUrl, candidate.RawSourceUrl, "(missing)"),
            EvidenceSummary = BuildEvidenceSummary(candidate.EvidenceText),
            PrivacyRiskResult = riskScan.HasRisk ? string.Join(", ", riskScan.MatchedRules) : "none"
        };

        result.PlannedActions.Add(PlanPerson(candidate));
        result.PlannedActions.Add(PlanCompany(candidate));
        result.PlannedActions.Add(PlanSourceDocument(candidate));
        result.PlannedActions.Add("create or reuse person_company_relations verified/public row");
        result.PlannedActions.Add("update relation_candidates.review_status to verified");

        return result;
    }

    private async Task<RelationCandidateRecord?> LoadCandidateAsync(Guid candidateId, CancellationToken cancellationToken)
    {
        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var cmd = new NpgsqlCommand(@"
SELECT
    rc.id,
    rc.person_name,
    rc.company_name,
    COALESCE(rc.unified_business_no, '') AS unified_business_no,
    rc.guessed_relation_type,
    rc.confidence_suggestion,
    rc.evidence_text,
    rc.source_record_id,
    COALESCE(rc.source_url, '') AS source_url,
    rc.review_status,
    COALESCE(rc.review_note, '') AS review_note,
    rc.created_at,
    rc.updated_at,
    COALESCE(rr.source_type, '') AS source_type,
    COALESCE(rr.source_name, '') AS source_name,
    COALESCE(rr.source_url, '') AS raw_source_url
FROM relation_candidates rc
LEFT JOIN raw_source_records rr ON rr.id = rc.source_record_id
WHERE rc.id = @id;", connection);

        cmd.Parameters.AddWithValue("id", candidateId);

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new RelationCandidateRecord
        {
            Id = reader.GetGuid(0),
            PersonName = reader.GetString(1),
            CompanyName = reader.GetString(2),
            UnifiedBusinessNo = reader.GetString(3),
            GuessedRelationType = reader.GetString(4),
            ConfidenceSuggestion = reader.GetString(5),
            EvidenceText = reader.GetString(6),
            SourceRecordId = reader.IsDBNull(7) ? null : reader.GetGuid(7),
            SourceUrl = reader.GetString(8),
            ReviewStatus = reader.GetString(9),
            ReviewNote = reader.GetString(10),
            CreatedAt = reader.GetFieldValue<DateTimeOffset>(11),
            UpdatedAt = reader.GetFieldValue<DateTimeOffset>(12),
            SourceType = reader.GetString(13),
            SourceName = reader.GetString(14),
            RawSourceUrl = reader.GetString(15)
        };
    }

    private static async Task<(Guid Id, bool Created)> GetOrCreatePersonAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        RelationCandidateRecord candidate,
        CancellationToken cancellationToken)
    {
        await using var findCmd = new NpgsqlCommand("SELECT id FROM people WHERE name = @name LIMIT 1;", connection, transaction);
        findCmd.Parameters.AddWithValue("name", candidate.PersonName);
        var existing = await findCmd.ExecuteScalarAsync(cancellationToken);
        if (existing is Guid personId)
        {
            return (personId, false);
        }

        await using var insertCmd = new NpgsqlCommand(@"
INSERT INTO people (name, is_public)
VALUES (@name, TRUE)
RETURNING id;", connection, transaction);
        insertCmd.Parameters.AddWithValue("name", candidate.PersonName);

        return ((Guid)(await insertCmd.ExecuteScalarAsync(cancellationToken) ?? throw new InvalidOperationException("failed to create person")), true);
    }

    private static async Task<(Guid Id, bool Created)> GetOrCreateCompanyAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        RelationCandidateRecord candidate,
        CancellationToken cancellationToken)
    {
        object? existing = null;
        if (!string.IsNullOrWhiteSpace(candidate.UnifiedBusinessNo))
        {
            await using var findByNoCmd = new NpgsqlCommand("SELECT id FROM companies WHERE unified_business_no = @no LIMIT 1;", connection, transaction);
            findByNoCmd.Parameters.AddWithValue("no", candidate.UnifiedBusinessNo);
            existing = await findByNoCmd.ExecuteScalarAsync(cancellationToken);
        }

        if (existing is not Guid)
        {
            await using var findByNameCmd = new NpgsqlCommand("SELECT id FROM companies WHERE name = @name LIMIT 1;", connection, transaction);
            findByNameCmd.Parameters.AddWithValue("name", candidate.CompanyName);
            existing = await findByNameCmd.ExecuteScalarAsync(cancellationToken);
        }

        if (existing is Guid companyId)
        {
            return (companyId, false);
        }

        await using var insertCmd = new NpgsqlCommand(@"
INSERT INTO companies (name, unified_business_no, source_url, is_public)
VALUES (@name, @unified_business_no, @source_url, TRUE)
RETURNING id;", connection, transaction);
        insertCmd.Parameters.AddWithValue("name", candidate.CompanyName);
        insertCmd.Parameters.AddWithValue("unified_business_no", Nullable(candidate.UnifiedBusinessNo));
        insertCmd.Parameters.AddWithValue("source_url", Nullable(FirstNonEmpty(candidate.SourceUrl, candidate.RawSourceUrl)));

        return ((Guid)(await insertCmd.ExecuteScalarAsync(cancellationToken) ?? throw new InvalidOperationException("failed to create company")), true);
    }

    private static async Task<(Guid Id, bool Created)> GetOrCreateSourceDocumentAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        RelationCandidateRecord candidate,
        CancellationToken cancellationToken)
    {
        var sourceUrl = FirstNonEmpty(candidate.SourceUrl, candidate.RawSourceUrl);
        var sourceName = FirstNonEmpty(candidate.SourceName);
        var sourceType = FirstNonEmpty(candidate.SourceType, "manual_review");

        if (string.IsNullOrWhiteSpace(sourceName) && string.IsNullOrWhiteSpace(sourceUrl))
        {
            throw new InvalidOperationException("cannot create source_document without source_name and source_url");
        }

        if (candidate.SourceRecordId is Guid rawRecordId)
        {
            await using var findCmd = new NpgsqlCommand(@"
SELECT id
FROM source_documents
WHERE raw_record_id = @raw_record_id
  AND is_public = TRUE
LIMIT 1;", connection, transaction);
            findCmd.Parameters.AddWithValue("raw_record_id", rawRecordId);
            var existing = await findCmd.ExecuteScalarAsync(cancellationToken);
            if (existing is Guid existingId)
            {
                return (existingId, false);
            }

            await using var insertFromRawCmd = new NpgsqlCommand(@"
INSERT INTO source_documents (source_type, source_name, source_url, raw_record_id, is_public)
VALUES (@source_type, @source_name, @source_url, @raw_record_id, TRUE)
RETURNING id;", connection, transaction);
            insertFromRawCmd.Parameters.AddWithValue("source_type", sourceType);
            insertFromRawCmd.Parameters.AddWithValue("source_name", Nullable(sourceName));
            insertFromRawCmd.Parameters.AddWithValue("source_url", Nullable(sourceUrl));
            insertFromRawCmd.Parameters.AddWithValue("raw_record_id", rawRecordId);

            return ((Guid)(await insertFromRawCmd.ExecuteScalarAsync(cancellationToken) ?? throw new InvalidOperationException("failed to create source_document")), true);
        }

        await using var insertCmd = new NpgsqlCommand(@"
INSERT INTO source_documents (source_type, source_name, source_url, is_public)
VALUES (@source_type, @source_name, @source_url, TRUE)
RETURNING id;", connection, transaction);
        insertCmd.Parameters.AddWithValue("source_type", sourceType);
        insertCmd.Parameters.AddWithValue("source_name", Nullable(sourceName));
        insertCmd.Parameters.AddWithValue("source_url", Nullable(sourceUrl));

        return ((Guid)(await insertCmd.ExecuteScalarAsync(cancellationToken) ?? throw new InvalidOperationException("failed to create source_document")), true);
    }

    private static async Task<(Guid Id, bool Created)> GetOrCreateRelationAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        RelationCandidateRecord candidate,
        Guid personId,
        Guid companyId,
        Guid sourceDocumentId,
        CancellationToken cancellationToken)
    {
        await using var findCmd = new NpgsqlCommand(@"
SELECT id
FROM person_company_relations
WHERE person_id = @person_id
  AND company_id = @company_id
  AND relation_type = @relation_type
  AND evidence_source_id = @evidence_source_id
LIMIT 1;", connection, transaction);
        findCmd.Parameters.AddWithValue("person_id", personId);
        findCmd.Parameters.AddWithValue("company_id", companyId);
        findCmd.Parameters.AddWithValue("relation_type", candidate.GuessedRelationType);
        findCmd.Parameters.AddWithValue("evidence_source_id", sourceDocumentId);
        var existing = await findCmd.ExecuteScalarAsync(cancellationToken);
        if (existing is Guid relationId)
        {
            return (relationId, false);
        }

        await using var insertCmd = new NpgsqlCommand(@"
INSERT INTO person_company_relations (
    person_id,
    company_id,
    relation_type,
    confidence_level,
    evidence_source_id,
    evidence_text,
    verification_status,
    is_public,
    reviewed_by,
    reviewed_at
)
VALUES (
    @person_id,
    @company_id,
    @relation_type,
    @confidence_level,
    @evidence_source_id,
    @evidence_text,
    'verified',
    TRUE,
    'local-admin',
    NOW()
)
RETURNING id;", connection, transaction);
        insertCmd.Parameters.AddWithValue("person_id", personId);
        insertCmd.Parameters.AddWithValue("company_id", companyId);
        insertCmd.Parameters.AddWithValue("relation_type", candidate.GuessedRelationType);
        insertCmd.Parameters.AddWithValue("confidence_level", candidate.ConfidenceSuggestion);
        insertCmd.Parameters.AddWithValue("evidence_source_id", sourceDocumentId);
        insertCmd.Parameters.AddWithValue("evidence_text", candidate.EvidenceText);

        return ((Guid)(await insertCmd.ExecuteScalarAsync(cancellationToken) ?? throw new InvalidOperationException("failed to create relation")), true);
    }

    private static async Task UpdateCandidateStatusAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid candidateId,
        Guid relationId,
        CancellationToken cancellationToken)
    {
        await using var updateCmd = new NpgsqlCommand(@"
UPDATE relation_candidates
SET review_status = 'verified',
    review_note = COALESCE(review_note, '') || CASE WHEN COALESCE(review_note, '') = '' THEN '' ELSE E'\n' END || @note,
    updated_at = NOW()
WHERE id = @id;", connection, transaction);
        updateCmd.Parameters.AddWithValue("id", candidateId);
        updateCmd.Parameters.AddWithValue("note", $"promoted_at={DateTimeOffset.UtcNow:O}; relation_id={relationId}");
        await updateCmd.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string PlanPerson(RelationCandidateRecord candidate) =>
        $"create or reuse people by name '{candidate.PersonName}'";

    private static string PlanCompany(RelationCandidateRecord candidate) =>
        string.IsNullOrWhiteSpace(candidate.UnifiedBusinessNo)
            ? $"create or reuse companies by company name '{candidate.CompanyName}'"
            : $"create or reuse companies by unified_business_no '{candidate.UnifiedBusinessNo}'";

    private static string PlanSourceDocument(RelationCandidateRecord candidate) =>
        candidate.SourceRecordId is Guid rawId
            ? $"create or reuse public source_document from raw_source_records {rawId}"
            : "create public source_document from source_url";

    private static string BuildEvidenceSummary(string text)
    {
        const int maxLength = 120;
        var normalized = text.Replace(Environment.NewLine, " ").Trim();
        return normalized.Length <= maxLength ? normalized : normalized[..maxLength] + "...";
    }

    private static string FirstNonEmpty(params string[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static object Nullable(string value) => string.IsNullOrWhiteSpace(value) ? DBNull.Value : value;

    private static void PrintDryRunSummary(PromotionResult result)
    {
        Console.WriteLine("mode: promote dry-run");
        Console.WriteLine($"candidate id: {result.CandidateId}");
        Console.WriteLine($"person name: {result.PersonName}");
        Console.WriteLine($"company name: {result.CompanyName}");
        Console.WriteLine($"unified business no: {result.UnifiedBusinessNo}");
        Console.WriteLine($"guessed relation type: {result.GuessedRelationType}");
        Console.WriteLine($"confidence suggestion: {result.ConfidenceSuggestion}");
        Console.WriteLine($"source name: {result.SourceName}");
        Console.WriteLine($"source url: {result.SourceUrl}");
        Console.WriteLine($"evidence text summary: {result.EvidenceSummary}");
        Console.WriteLine($"privacy risk result: {result.PrivacyRiskResult}");
        Console.WriteLine($"can promote: {result.CanPromote}");
        if (!result.CanPromote)
        {
            Console.WriteLine($"failed reason: {result.FailureReason}");
        }
        Console.WriteLine("planned actions:");
        foreach (var action in result.PlannedActions)
        {
            Console.WriteLine($"- {action}");
        }
    }

    private static void PrintExecuteSummary(PromotionResult result)
    {
        Console.WriteLine("mode: promote execute");
        Console.WriteLine($"created/reused person id: {result.PersonId} ({(result.PersonCreated ? "created" : "reused")})");
        Console.WriteLine($"created/reused company id: {result.CompanyId} ({(result.CompanyCreated ? "created" : "reused")})");
        Console.WriteLine($"created/reused source document id: {result.SourceDocumentId} ({(result.SourceDocumentCreated ? "created" : "reused")})");
        Console.WriteLine($"created/reused relation id: {result.RelationId} ({(result.RelationCreated ? "created" : "already exists")})");
        Console.WriteLine($"candidate review_status update: {result.CandidateStatusUpdate}");
        Console.WriteLine("transaction committed");
    }
}
