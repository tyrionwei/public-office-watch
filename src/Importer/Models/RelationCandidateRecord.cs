namespace PublicOfficialInterest.Importer.Models;

public sealed class RelationCandidateRecord
{
    public Guid Id { get; set; }
    public string PersonName { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string UnifiedBusinessNo { get; set; } = string.Empty;
    public string GuessedRelationType { get; set; } = string.Empty;
    public string ConfidenceSuggestion { get; set; } = string.Empty;
    public string EvidenceText { get; set; } = string.Empty;
    public Guid? SourceRecordId { get; set; }
    public string SourceUrl { get; set; } = string.Empty;
    public string ReviewStatus { get; set; } = string.Empty;
    public string ReviewNote { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public string SourceName { get; set; } = string.Empty;
    public string RawSourceUrl { get; set; } = string.Empty;
}
