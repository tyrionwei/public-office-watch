namespace PublicOfficialInterest.Importer.Models;

public sealed class ChangeSet
{
    public string RunDate { get; set; } = string.Empty;
    public string GeneratedBy { get; set; } = string.Empty;
    public ChangeSummary Summary { get; set; } = new();
    public List<ChangeItem> Changes { get; set; } = new();
}

public sealed class ChangeSummary
{
    public int NewCandidates { get; set; }
    public int UpdateCandidates { get; set; }
    public int RejectedCandidates { get; set; }
    public int HighRiskItems { get; set; }
}
