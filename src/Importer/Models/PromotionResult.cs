namespace PublicOfficialInterest.Importer.Models;

public sealed class PromotionResult
{
    public bool Success { get; set; }
    public bool IsDryRun { get; set; }
    public bool CanPromote { get; set; }
    public string FailureReason { get; set; } = string.Empty;
    public Guid CandidateId { get; set; }
    public string PersonName { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string UnifiedBusinessNo { get; set; } = string.Empty;
    public string GuessedRelationType { get; set; } = string.Empty;
    public string ConfidenceSuggestion { get; set; } = string.Empty;
    public string SourceName { get; set; } = string.Empty;
    public string SourceUrl { get; set; } = string.Empty;
    public string EvidenceSummary { get; set; } = string.Empty;
    public string PrivacyRiskResult { get; set; } = string.Empty;
    public List<string> PlannedActions { get; } = new();
    public Guid? PersonId { get; set; }
    public bool PersonCreated { get; set; }
    public Guid? CompanyId { get; set; }
    public bool CompanyCreated { get; set; }
    public Guid? SourceDocumentId { get; set; }
    public bool SourceDocumentCreated { get; set; }
    public Guid? RelationId { get; set; }
    public bool RelationCreated { get; set; }
    public string CandidateStatusUpdate { get; set; } = string.Empty;
    public bool TransactionCommitted { get; set; }
}
