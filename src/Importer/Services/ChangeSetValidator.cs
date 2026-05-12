using System.Text.RegularExpressions;
using PublicOfficialInterest.Importer.Models;
using PublicOfficialInterest.Importer.Validators;

namespace PublicOfficialInterest.Importer.Services;

public sealed class ChangeSetValidator
{
    private static readonly HashSet<string> AllowedConfidence = ["A", "B", "C", "D"];
    private static readonly HashSet<string> AllowedReviewStatus = ["pending"];
    private static readonly Regex UnifiedBusinessNoPattern = new(@"^\d{8}$", RegexOptions.Compiled);
    private readonly PrivacyRiskValidator _privacyRiskValidator = new();

    public ValidationResult Validate(ChangeSet changeSet)
    {
        var result = new ValidationResult();

        if (string.IsNullOrWhiteSpace(changeSet.RunDate))
            result.Errors.Add("runDate is required.");

        if (string.IsNullOrWhiteSpace(changeSet.GeneratedBy))
            result.Errors.Add("generatedBy is required.");

        if (changeSet.Changes.Count == 0)
            result.Errors.Add("changes must contain at least one item.");

        for (var i = 0; i < changeSet.Changes.Count; i++)
        {
            ValidateItem(changeSet.Changes[i], i, result.Errors);
        }

        return result;
    }

    private void ValidateItem(ChangeItem item, int index, List<string> errors)
    {
        var prefix = $"changes[{index}]";

        if (!AllowedActions.Values.Contains(item.Action))
            errors.Add($"{prefix}: action not allowed: {item.Action}");

        if (item.Action == "create_relation_candidate" && string.IsNullOrWhiteSpace(item.PersonName))
            errors.Add($"{prefix}: personName is required for create_relation_candidate.");

        if (item.Action == "create_person_candidate" && string.IsNullOrWhiteSpace(item.PersonName))
            errors.Add($"{prefix}: personName is required for create_person_candidate.");

        if ((item.Action == "create_relation_candidate" || item.Action == "create_company_candidate") && string.IsNullOrWhiteSpace(item.CompanyName))
            errors.Add($"{prefix}: companyName is required.");

        if (string.IsNullOrWhiteSpace(item.EvidenceText))
            errors.Add($"{prefix}: evidenceText is required.");

        if (string.IsNullOrWhiteSpace(item.SourceName) && string.IsNullOrWhiteSpace(item.SourceUrl))
            errors.Add($"{prefix}: sourceName or sourceUrl is required.");

        if (string.IsNullOrWhiteSpace(item.SourceType))
            errors.Add($"{prefix}: sourceType is required.");

        if (!AllowedConfidence.Contains(item.ConfidenceSuggestion))
            errors.Add($"{prefix}: confidenceSuggestion must be A/B/C/D: {item.ConfidenceSuggestion}");

        if (!AllowedReviewStatus.Contains(item.ReviewStatus))
            errors.Add($"{prefix}: reviewStatus must be pending.");

        if (item.IsPublic)
            errors.Add($"{prefix}: isPublic must be false.");

        if (!string.IsNullOrWhiteSpace(item.GuessedRelationType) && !RelationTypes.Allowed.Contains(item.GuessedRelationType))
            errors.Add($"{prefix}: guessedRelationType is not in whitelist: {item.GuessedRelationType}");

        if (!string.IsNullOrWhiteSpace(item.UnifiedBusinessNo) && !UnifiedBusinessNoPattern.IsMatch(item.UnifiedBusinessNo))
            errors.Add($"{prefix}: unifiedBusinessNo must be 8 digits.");

        var riskScan = _privacyRiskValidator.Scan(item);
        if (riskScan.HasRisk)
            errors.Add($"{prefix}: sensitive data detected ({string.Join(", ", riskScan.MatchedRules)})");
    }
}
