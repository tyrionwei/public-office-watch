namespace PublicOfficialInterest.Importer.Models;

public sealed class RiskScanResult
{
    public bool HasRisk => MatchedRules.Count > 0;
    public List<string> MatchedRules { get; } = new();
}
