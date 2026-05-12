using PublicOfficialInterest.Importer.Models;
using PublicOfficialInterest.Importer.Validators;

namespace PublicOfficialInterest.Importer.Services;

public sealed class CandidatePromotionValidator
{
    private static readonly HashSet<string> AllowedRelationTypes =
    [
        "SelfDeclaredInvestment",
        "SpouseDeclaredInvestment",
        "MinorChildDeclaredInvestment",
        "CompanyDirector",
        "CompanyRepresentative",
        "PoliticalDonation",
        "GovernmentProcurement",
        "NewsMention",
        "CourtDocumentMention",
        "ManualResearchLead"
    ];

    private static readonly HashSet<string> AllowedConfidenceSuggestions = ["A", "B", "C"];

    private readonly PrivacyRiskValidator _privacyRiskValidator = new();

    public (bool IsValid, List<string> Errors, RiskScanResult RiskScan) Validate(RelationCandidateRecord candidate)
    {
        var errors = new List<string>();

        if (candidate.Id == Guid.Empty)
        {
            errors.Add("candidate id is not a valid UUID");
        }

        if (string.IsNullOrWhiteSpace(candidate.PersonName))
        {
            errors.Add("person_name cannot be blank");
        }

        if (string.IsNullOrWhiteSpace(candidate.CompanyName))
        {
            errors.Add("company_name cannot be blank");
        }

        if (!string.Equals(candidate.ReviewStatus, "pending", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("candidate review_status must be pending");
        }

        if (!AllowedRelationTypes.Contains(candidate.GuessedRelationType))
        {
            errors.Add("guessed_relation_type is not in allowlist");
        }

        if (string.Equals(candidate.ConfidenceSuggestion, "D", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("confidence_suggestion D cannot be promoted");
        }
        else if (!AllowedConfidenceSuggestions.Contains(candidate.ConfidenceSuggestion))
        {
            errors.Add("confidence_suggestion must be A, B, or C");
        }

        if (string.IsNullOrWhiteSpace(candidate.EvidenceText))
        {
            errors.Add("evidence_text cannot be blank");
        }

        if (string.IsNullOrWhiteSpace(candidate.SourceUrl) && candidate.SourceRecordId is null)
        {
            errors.Add("source_url or source_record_id is required");
        }

        var changeItem = new ChangeItem
        {
            PersonName = candidate.PersonName,
            CompanyName = candidate.CompanyName,
            EvidenceText = candidate.EvidenceText,
            SourceName = candidate.SourceName,
            SourceUrl = candidate.SourceUrl
        };

        var riskScan = _privacyRiskValidator.Scan(changeItem);
        if (riskScan.HasRisk)
        {
            errors.Add("privacy risk detected: " + string.Join(", ", riskScan.MatchedRules));
        }

        return (errors.Count == 0, errors, riskScan);
    }
}
