using PublicOfficialInterest.Importer.Models;
using PublicOfficialInterest.Importer.Validators;

namespace PublicOfficialInterest.Importer.Services;

public sealed class ChangeSetValidator
{
    private static readonly HashSet<string> AllowedActions =
    [
        "create_raw_source_record",
        "create_relation_candidate",
        "create_company_candidate",
        "create_person_candidate"
    ];

    private static readonly HashSet<string> AllowedConfidence = ["A", "B", "C", "D"];
    private static readonly HashSet<string> AllowedReviewStatus = ["pending"];
    private readonly PrivacyRiskValidator _privacyRiskValidator = new();

    public IReadOnlyList<string> Validate(ChangeSet changeSet)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(changeSet.RunDate))
            errors.Add("runDate is required.");

        if (string.IsNullOrWhiteSpace(changeSet.GeneratedBy))
            errors.Add("generatedBy is required.");

        if (changeSet.Changes.Count == 0)
            errors.Add("changes must contain at least one item.");

        for (var i = 0; i < changeSet.Changes.Count; i++)
        {
            ValidateItem(changeSet.Changes[i], i, errors);
        }

        return errors;
    }

    private void ValidateItem(ChangeItem item, int index, List<string> errors)
    {
        var prefix = $"changes[{index}]";

        if (!AllowedActions.Contains(item.Action))
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

        if (_privacyRiskValidator.ContainsSensitiveData(item))
            errors.Add($"{prefix}: sensitive data detected in item related to {item.CompanyName}");
    }
}
