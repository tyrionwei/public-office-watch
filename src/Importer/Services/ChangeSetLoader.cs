using System.Text.Json;
using PublicOfficialInterest.Importer.Models;

namespace PublicOfficialInterest.Importer.Services;

public sealed class ChangeSetLoader
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public ChangeSet Load(string path)
    {
        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Change set file not found: {path}");
        }

        var json = File.ReadAllText(path);
        var changeSet = JsonSerializer.Deserialize<ChangeSet>(json, JsonOptions);

        if (changeSet is null)
        {
            throw new InvalidOperationException("Unable to deserialize changes.json");
        }

        return changeSet;
    }
}
