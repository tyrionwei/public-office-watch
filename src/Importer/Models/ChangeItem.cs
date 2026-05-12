namespace PublicOfficialInterest.Importer.Models;

public sealed class ChangeItem
{
    public string Action { get; set; } = string.Empty;
    public string PersonName { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string UnifiedBusinessNo { get; set; } = string.Empty;
    public string GuessedRelationType { get; set; } = string.Empty;
    public string ConfidenceSuggestion { get; set; } = string.Empty;
    public string EvidenceText { get; set; } = string.Empty;
    public string SourceName { get; set; } = string.Empty;
    public string SourceUrl { get; set; } = string.Empty;
    public string SourceType { get; set; } = string.Empty;
    public string ReviewStatus { get; set; } = string.Empty;
    public bool IsPublic { get; set; }
    public List<string> RiskFlags { get; set; } = new();
}
