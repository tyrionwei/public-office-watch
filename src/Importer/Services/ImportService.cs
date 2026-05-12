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

        foreach (var item in changeSet.Changes)
        {
            Console.WriteLine($"[DRY-RUN] {item.Action}: {item.PersonName} -> {item.CompanyName} ({item.GuessedRelationType}, {item.ConfidenceSuggestion})");
        }
    }
}
