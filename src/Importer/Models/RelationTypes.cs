namespace PublicOfficialInterest.Importer.Models;

public static class RelationTypes
{
    public static readonly HashSet<string> Allowed =
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
}
