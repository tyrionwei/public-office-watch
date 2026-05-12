using PublicOfficialInterest.Importer.Models;

namespace PublicOfficialInterest.Importer.Services;

public interface IImportService
{
    Task RunAsync(ChangeSet changeSet, CancellationToken cancellationToken = default);
}
