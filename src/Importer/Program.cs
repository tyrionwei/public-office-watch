using PublicOfficialInterest.Importer.Services;

if (args.Length > 0 && (args[0] == "--help" || args[0] == "-h"))
{
    Console.WriteLine("Usage:");
    Console.WriteLine("  dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- <path-to-changes.json>");
    Console.WriteLine();
    Console.WriteLine("Default:");
    Console.WriteLine("  Uses ../../samples/sample-changes.json when no path is provided.");
    return 0;
}

var inputPath = args.Length > 0
    ? args[0]
    : Path.Combine("..", "..", "samples", "sample-changes.json");

var loader = new ChangeSetLoader();
var validator = new ChangeSetValidator();
var importService = new ImportService(validator);

try
{
    var changeSet = loader.Load(inputPath);
    importService.RunDryRun(changeSet);
    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine($"[ERROR] {ex.Message}");
    return 1;
}
