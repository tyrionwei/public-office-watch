namespace PublicOfficialInterest.Importer.Models;

public sealed class ValidationResult
{
    public bool IsValid => Errors.Count == 0;
    public List<string> Errors { get; } = new();
}
