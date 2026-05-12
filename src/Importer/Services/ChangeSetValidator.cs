using System.Text.RegularExpressions;
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
    private readonly PrivacyRiskValidator _privacyRiskValidator = new();

    public IReadOnlyList<string> Validate(ChangeSet changeSet)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(changeSet.RunDate))
            errors.Add("runDate is required.");

        foreach (var item in changeSet.Changes)
        {
            ValidateItem(item, errors);
        }

        return errors;
    }

    private void ValidateItem(ChangeItem item, List<string> errors)
    {
        if (!AllowedActions.Contains(item.Action))
            errors.Add($"Action not allowed: {item.Action}");

        if (item.Action == "create_relation_candidate" && string.IsNullOrWhiteSpace(item.PersonName))
            errors.Add("personName is required for create_relation_candidate.");

        if (string.IsNullOrWhiteSpace(item.CompanyName))
            errors.Add("companyName is required.");

        if (string.IsNullOrWhiteSpace(item.EvidenceText))
            errors.Add("evidenceText is required.");

        if (string.IsNullOrWhiteSpace(item.SourceName) && string.IsNullOrWhiteSpace(item.SourceUrl))
            errors.Add("sourceName or sourceUrl is required.");

        if (!AllowedConfidence.Contains(item.ConfidenceSuggestion))
            errors.Add($"confidenceSuggestion must be A/B/C/D: {item.ConfidenceSuggestion}");

        if (!string.Equals(item.ReviewStatus, "pending", StringComparison.OrdinalIgnoreCase))
            errors.Add("reviewStatus must be pending.");

        if (item.IsPublic)
            errors.Add("isPublic must be false.");

        if (_privacyRiskValidator.ContainsSensitiveData(item))
            errors.Add($"Sensitive data detected in item: {item.CompanyName}");
    }
}
