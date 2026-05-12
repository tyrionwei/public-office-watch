using PublicOfficialInterest.Importer.Models;
using PublicOfficialInterest.Importer.Services;

static int PrintUsage()
{
    Console.WriteLine("Usage:");
    Console.WriteLine("  dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --dry-run <path-to-changes.json>");
    Console.WriteLine("  dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --execute <path-to-changes.json>");
    Console.WriteLine("  dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --promote-candidate <candidateId> --dry-run");
    Console.WriteLine("  dotnet run --project src/Importer/PublicOfficialInterest.Importer.csproj -- --promote-candidate <candidateId> --confirm");
    return 1;
}

if (args.Length > 0 && (args[0] == "--help" || args[0] == "-h"))
{
    PrintUsage();
    return 0;
}

if (args.Contains("--promote-candidate", StringComparer.Ordinal))
{
    var promoteIndex = Array.IndexOf(args, "--promote-candidate");
    if (promoteIndex < 0 || promoteIndex + 1 >= args.Length)
    {
        return PrintUsage();
    }

    if (!Guid.TryParse(args[promoteIndex + 1], out var candidateId))
    {
        Console.Error.WriteLine("[ERROR] candidate id is not a valid UUID.");
        return 1;
    }

    var isDryRun = args.Contains("--dry-run", StringComparer.Ordinal);
    var isConfirm = args.Contains("--confirm", StringComparer.Ordinal);
    if (isDryRun == isConfirm)
    {
        Console.Error.WriteLine("[ERROR] promote mode requires exactly one of --dry-run or --confirm.");
        return PrintUsage();
    }

    var connectionString = Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        Console.Error.WriteLine("[ERROR] DATABASE_CONNECTION_STRING is required for promote mode.");
        return 1;
    }

    var promotionService = new CandidatePromotionService(connectionString, new CandidatePromotionValidator());

    try
    {
        if (isDryRun)
        {
            await promotionService.DryRunAsync(candidateId);
        }
        else
        {
            await promotionService.PromoteAsync(candidateId);
        }

        return 0;
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[ERROR] {ex.Message}");
        return 1;
    }
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
