using PublicOfficialInterest.Importer.Models;
using PublicOfficialInterest.Importer.Validators;

namespace PublicOfficialInterest.Importer.Services;

public sealed class DryRunImportService : IImportService
{
    private readonly ChangeSetValidator _validator;
    private readonly PrivacyRiskValidator _privacyRiskValidator = new();

    public DryRunImportService(ChangeSetValidator validator)
    {
        _validator = validator;
    }

    public Task RunAsync(ChangeSet changeSet, CancellationToken cancellationToken = default)
    {
        var validation = _validator.Validate(changeSet);
        if (!validation.IsValid)
        {
            throw new InvalidOperationException("Validation failed:\n- " + string.Join("\n- ", validation.Errors));
        }

        var riskItems = new List<string>();

        Console.WriteLine($"RunDate: {changeSet.RunDate}");
        Console.WriteLine($"GeneratedBy: {changeSet.GeneratedBy}");
        Console.WriteLine($"Changes to import: {changeSet.Changes.Count}");
        Console.WriteLine();

        foreach (var item in changeSet.Changes)
        {
            var riskScan = _privacyRiskValidator.Scan(item);
            if (riskScan.HasRisk)
            {
                riskItems.Add($"{item.Action}:{item.CompanyName} => {string.Join(", ", riskScan.MatchedRules)}");
            }

            Console.WriteLine($"[DRY-RUN] action={item.Action}");
            Console.WriteLine($"  personName={item.PersonName}");
            Console.WriteLine($"  companyName={item.CompanyName}");
            Console.WriteLine($"  relationType={item.GuessedRelationType}");
            Console.WriteLine($"  confidence={item.ConfidenceSuggestion}");
            Console.WriteLine($"  unifiedBusinessNo={item.UnifiedBusinessNo}");
            Console.WriteLine($"  sourceType={item.SourceType}");
            Console.WriteLine($"  sourceName={item.SourceName}");
            Console.WriteLine($"  reviewStatus={item.ReviewStatus}");
            Console.WriteLine($"  isPublic={item.IsPublic}");
            if (item.RiskFlags.Count > 0)
            {
                Console.WriteLine($"  riskFlags={string.Join(", ", item.RiskFlags)}");
            }
            Console.WriteLine();
        }

        Console.WriteLine("Summary:");
        Console.WriteLine($"  runDate={changeSet.RunDate}");
        Console.WriteLine($"  totalChanges={changeSet.Changes.Count}");
        Console.WriteLine("  insertedRawSourceRecords=0");
        Console.WriteLine("  insertedSourceDocuments=0");
        Console.WriteLine("  insertedRelationCandidates=0");
        Console.WriteLine($"  rejected={changeSet.Summary.RejectedCandidates}");
        Console.WriteLine($"  highRiskItems={changeSet.Summary.HighRiskItems}");
        Console.WriteLine("  mode=dry-run");

        Console.WriteLine("Risk scan:");
        if (riskItems.Count == 0)
        {
            Console.WriteLine("  none");
        }
        else
        {
            foreach (var item in riskItems)
            {
                Console.WriteLine($"  {item}");
            }
        }

        return Task.CompletedTask;
    }
}
