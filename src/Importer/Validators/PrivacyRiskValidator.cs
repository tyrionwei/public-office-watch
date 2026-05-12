using System.Text.RegularExpressions;
using PublicOfficialInterest.Importer.Models;

namespace PublicOfficialInterest.Importer.Validators;

public sealed class PrivacyRiskValidator
{
    private static readonly Regex IdPattern = new(@"\b[A-Z][12]\d{8}\b", RegexOptions.Compiled);
    private static readonly Regex MobilePattern = new(@"\b09\d{8}\b", RegexOptions.Compiled);
    private static readonly Regex LandlinePattern = new(@"\b0\d{1,2}-?\d{6,8}\b", RegexOptions.Compiled);
    private static readonly Regex EmailPattern = new(@"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex BirthdayPattern = new(@"\b(19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b", RegexOptions.Compiled);
    private static readonly Regex FullAddressPattern = new(@"\b.+(?:縣|市).+(?:區|鄉|鎮|市).+(?:路|街|大道).+(?:號)\b", RegexOptions.Compiled);

    public bool ContainsSensitiveData(ChangeItem item)
    {
        return Scan(item).HasRisk;
    }

    public RiskScanResult Scan(ChangeItem item)
    {
        var result = new RiskScanResult();
        var combined = string.Join(" ",
            item.PersonName,
            item.CompanyName,
            item.EvidenceText,
            item.SourceName,
            item.SourceUrl);

        if (IdPattern.IsMatch(combined)) result.MatchedRules.Add("national_id");
        if (MobilePattern.IsMatch(combined)) result.MatchedRules.Add("mobile_phone");
        if (LandlinePattern.IsMatch(combined)) result.MatchedRules.Add("landline_phone");
        if (EmailPattern.IsMatch(combined)) result.MatchedRules.Add("email");
        if (BirthdayPattern.IsMatch(combined)) result.MatchedRules.Add("birthday");
        if (FullAddressPattern.IsMatch(combined)) result.MatchedRules.Add("full_address");
        if (combined.Contains("未成年子女", StringComparison.Ordinal)) result.MatchedRules.Add("minor_child_reference");

        return result;
    }
}
