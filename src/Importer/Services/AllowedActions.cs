namespace PublicOfficialInterest.Importer.Services;

public static class AllowedActions
{
    public static readonly HashSet<string> Values =
    [
        "create_raw_source_record",
        "create_relation_candidate",
        "create_company_candidate",
        "create_person_candidate"
    ];

    public static readonly HashSet<string> DisallowedExamples =
    [
        "mark_as_verified",
        "set_public_true",
        "delete_record",
        "update_verified_relation"
    ];
}
