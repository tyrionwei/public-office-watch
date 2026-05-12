using PublicOfficialInterest.Importer.Models;

namespace PublicOfficialInterest.Importer.Services;

public sealed class ImportService
{
    private readonly ChangeSetValidator _validator;

    public ImportService(ChangeSetValidator validator)
    {
        _validator = validator;
    }

    public void RunDryRun(ChangeSet changeSet)
    {
        var errors = _validator.Validate(changeSet);
        if (errors.Count > 0)
        {
            throw new InvalidOperationException("Validation failed:\n- " + string.Join("\n- ", errors));
        }

        Console.WriteLine($"RunDate: {changeSet.RunDate}");
        Console.WriteLine($"GeneratedBy: {changeSet.GeneratedBy}");
        Console.WriteLine($"Changes to import: {changeSet.Changes.Count}");
        Console.WriteLine();

        foreach (var item in changeSet.Changes)
        {
            Console.WriteLine($"[DRY-RUN] action={item.Action}");
            Console.WriteLine($"  personName={item.PersonName}");
            Console.WriteLine($"  companyName={item.CompanyName}");
            Console.WriteLine($"  relationType={item.GuessedRelationType}");
            Console.WriteLine($"  confidence={item.ConfidenceSuggestion}");
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
    }
}
