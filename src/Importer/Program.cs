using PublicOfficialInterest.Importer.Models;
using PublicOfficialInterest.Importer.Services;

if (args.Length > 0 && (args[0] == "--help" || args[0] == "-h"))
{
    Console.WriteLine("Usage:");
    Console.WriteLine("  dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --dry-run <path-to-changes.json>");
    Console.WriteLine("  dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --execute <path-to-changes.json>");
    Console.WriteLine();
    Console.WriteLine("Default:");
    Console.WriteLine("  Uses --dry-run ../../samples/sample-changes.json when no mode/path is provided.");
    return 0;
}

var mode = ImportMode.DryRun;
string? inputPath = null;

foreach (var arg in args)
{
    if (arg == "--dry-run")
    {
        mode = ImportMode.DryRun;
    }
    else if (arg == "--execute")
    {
        mode = ImportMode.Execute;
    }
    else if (!arg.StartsWith("--", StringComparison.Ordinal))
    {
        inputPath = arg;
    }
}

inputPath ??= Path.Combine("..", "..", "samples", "sample-changes.json");

var loader = new ChangeSetLoader();
var validator = new ChangeSetValidator();
IImportService importService;

if (mode == ImportMode.Execute)
{
    var connectionString = Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException("DATABASE_CONNECTION_STRING is required for --execute mode.");
    }

    importService = new DatabaseImportService(validator, connectionString);
}
else
{
    importService = new DryRunImportService(validator);
}

try
{
    var changeSet = loader.Load(inputPath);
    await importService.RunAsync(changeSet);
    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine($"[ERROR] {ex.Message}");
    return 1;
}
