using PublicOfficialInterest.Importer.Services;

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
