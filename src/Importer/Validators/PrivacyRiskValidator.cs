using System.Text.RegularExpressions;
using PublicOfficialInterest.Importer.Models;

namespace PublicOfficialInterest.Importer.Validators;

public sealed class PrivacyRiskValidator
{
    private static readonly Regex IdPattern = new(@"\b[A-Z][12]\d{8}\b", RegexOptions.Compiled);
    private static readonly Regex PhonePattern = new(@"\b09\d{8}\b", RegexOptions.Compiled);

    public bool ContainsSensitiveData(ChangeItem item)
    {
        var combined = string.Join(" ",
            item.PersonName,
            item.CompanyName,
            item.EvidenceText,
            item.SourceName,
            item.SourceUrl);

        return IdPattern.IsMatch(combined)
            || PhonePattern.IsMatch(combined)
            || combined.Contains("未成年子女", StringComparison.Ordinal);
    }
}
