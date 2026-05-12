using Npgsql;
using PublicOfficialInterest.Importer.Models;

namespace PublicOfficialInterest.Importer.Services;

public sealed class DatabaseImportService : IImportService
{
    private readonly ChangeSetValidator _validator;
    private readonly string _connectionString;

    public DatabaseImportService(ChangeSetValidator validator, string connectionString)
    {
        _validator = validator;
        _connectionString = connectionString;
    }

    public async Task RunAsync(ChangeSet changeSet, CancellationToken cancellationToken = default)
    {
        var validation = _validator.Validate(changeSet);
        if (!validation.IsValid)
        {
            throw new InvalidOperationException("Validation failed:\n- " + string.Join("\n- ", validation.Errors));
        }

        var insertedRaw = 0;
        var insertedSourceDocuments = 0;
        var insertedCandidates = 0;

        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            foreach (var item in changeSet.Changes)
            {
                var rawRecordId = await InsertRawSourceRecordAsync(connection, transaction, item, cancellationToken);
                insertedRaw++;

                var sourceDocumentId = await InsertSourceDocumentAsync(connection, transaction, item, rawRecordId, cancellationToken);
                insertedSourceDocuments++;

                await InsertRelationCandidateAsync(connection, transaction, item, rawRecordId, cancellationToken);
                insertedCandidates++;
            }

            await transaction.CommitAsync(cancellationToken);

            Console.WriteLine("Summary:");
            Console.WriteLine($"  runDate={changeSet.RunDate}");
            Console.WriteLine($"  totalChanges={changeSet.Changes.Count}");
            Console.WriteLine($"  insertedRawSourceRecords={insertedRaw}");
            Console.WriteLine($"  insertedSourceDocuments={insertedSourceDocuments}");
            Console.WriteLine($"  insertedRelationCandidates={insertedCandidates}");
            Console.WriteLine("  rejected=0");
            Console.WriteLine($"  highRiskItems={changeSet.Summary.HighRiskItems}");
            Console.WriteLine("  mode=execute");
            Console.WriteLine();
            Console.WriteLine("WARNING: execute mode only inserted staging records. No official public relation was created.");
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static async Task<Guid> InsertRawSourceRecordAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        ChangeItem item,
        CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand(@"
INSERT INTO raw_source_records (source_type, source_name, source_url, raw_text, crawler_name, notes)
VALUES (@source_type, @source_name, @source_url, @raw_text, @crawler_name, @notes)
RETURNING id;", connection, transaction);

        cmd.Parameters.AddWithValue("source_type", item.SourceType);
        cmd.Parameters.AddWithValue("source_name", item.SourceName);
        cmd.Parameters.AddWithValue("source_url", (object?)item.SourceUrl ?? DBNull.Value);
        cmd.Parameters.AddWithValue("raw_text", item.EvidenceText);
        cmd.Parameters.AddWithValue("crawler_name", "PublicOfficialInterest.Importer");
        cmd.Parameters.AddWithValue("notes", $"action={item.Action}");

        return (Guid)(await cmd.ExecuteScalarAsync(cancellationToken) ?? throw new InvalidOperationException("Failed to insert raw_source_records."));
    }

    private static async Task<Guid> InsertSourceDocumentAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        ChangeItem item,
        Guid rawRecordId,
        CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand(@"
INSERT INTO source_documents (source_type, source_name, source_url, raw_record_id, is_public)
VALUES (@source_type, @source_name, @source_url, @raw_record_id, FALSE)
RETURNING id;", connection, transaction);

        cmd.Parameters.AddWithValue("source_type", item.SourceType);
        cmd.Parameters.AddWithValue("source_name", item.SourceName);
        cmd.Parameters.AddWithValue("source_url", (object?)item.SourceUrl ?? DBNull.Value);
        cmd.Parameters.AddWithValue("raw_record_id", rawRecordId);

        return (Guid)(await cmd.ExecuteScalarAsync(cancellationToken) ?? throw new InvalidOperationException("Failed to insert source_documents."));
    }

    private static async Task InsertRelationCandidateAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        ChangeItem item,
        Guid rawRecordId,
        CancellationToken cancellationToken)
    {
        await using var cmd = new NpgsqlCommand(@"
INSERT INTO relation_candidates (
    person_name,
    company_name,
    unified_business_no,
    guessed_relation_type,
    confidence_suggestion,
    evidence_text,
    source_record_id,
    source_url,
    review_status,
    review_note
)
VALUES (
    @person_name,
    @company_name,
    @unified_business_no,
    @guessed_relation_type,
    @confidence_suggestion,
    @evidence_text,
    @source_record_id,
    @source_url,
    'pending',
    @review_note
);", connection, transaction);

        cmd.Parameters.AddWithValue("person_name", item.PersonName);
        cmd.Parameters.AddWithValue("company_name", item.CompanyName);
        cmd.Parameters.AddWithValue("unified_business_no", (object?)item.UnifiedBusinessNo ?? DBNull.Value);
        cmd.Parameters.AddWithValue("guessed_relation_type", item.GuessedRelationType);
        cmd.Parameters.AddWithValue("confidence_suggestion", item.ConfidenceSuggestion);
        cmd.Parameters.AddWithValue("evidence_text", item.EvidenceText);
        cmd.Parameters.AddWithValue("source_record_id", rawRecordId);
        cmd.Parameters.AddWithValue("source_url", (object?)item.SourceUrl ?? DBNull.Value);
        cmd.Parameters.AddWithValue("review_note", "Imported by execute mode into staging only.");

        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }
}
