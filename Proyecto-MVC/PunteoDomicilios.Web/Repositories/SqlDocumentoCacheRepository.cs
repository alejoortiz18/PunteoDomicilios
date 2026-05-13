using Dapper;
using System.Data.SqlClient;
using PunteoDomicilios.Web.Models;

namespace PunteoDomicilios.Web.Repositories;

/// <summary>
/// Implementación del caché L2 usando SQL LocalDB y Dapper.
/// Si la base de datos no está disponible, todas las operaciones fallan
/// silenciosamente (el llamador debe atrapar la excepción y degradar).
/// </summary>
public class SqlDocumentoCacheRepository : IDocumentoCacheRepository
{
    private readonly string _connectionString;
    private readonly ILogger<SqlDocumentoCacheRepository> _logger;

    public SqlDocumentoCacheRepository(
        IConfiguration configuration,
        ILogger<SqlDocumentoCacheRepository> logger)
    {
        _connectionString = configuration["CacheLocal:ConnectionString"]
            ?? throw new InvalidOperationException("CacheLocal:ConnectionString no configurado.");
        _logger = logger;
    }

    // Valor centinela en StoragePath para indicar que el documento fue confirmado sin soporte.
    public const string FALTANTE_SENTINEL = "FALTANTE";

    public async Task<SoporteDataItem?> ObtenerAsync(string numeroDocumento, CancellationToken ct = default)
    {
        const string sql = """
            SELECT FechaRegistro, StorageDisk, StoragePath
            FROM   DocumentosIndexados
            WHERE  NumeroDocumento = @NumeroDocumento
            """;

        await using var conn = new SqlConnection(_connectionString);
        var row = await conn.QueryFirstOrDefaultAsync<DocumentoRow>(
            new CommandDefinition(sql, new { NumeroDocumento = numeroDocumento.Trim() }, cancellationToken: ct));

        if (row is null) return null;

        _logger.LogDebug("Caché L2 HIT: {NumeroDocumento} (faltante={EsFaltante})",
            numeroDocumento, row.StoragePath == FALTANTE_SENTINEL);
        return new SoporteDataItem(row.FechaRegistro ?? string.Empty, row.StorageDisk ?? string.Empty, row.StoragePath ?? string.Empty);
    }

    public async Task MarcarFaltanteAsync(string numeroDocumento, CancellationToken ct = default)
    {
        // Guarda una entrada con centinela FALTANTE para evitar re-consultar el API en reinicios.
        const string sql = """
            MERGE DocumentosIndexados AS target
            USING (SELECT @NumeroDocumento AS NumeroDocumento) AS src
                ON target.NumeroDocumento = src.NumeroDocumento
            WHEN MATCHED AND target.StoragePath <> '' AND target.StoragePath <> 'FALTANTE' THEN
                -- No sobreescribir un documento encontrado con un faltante (datos reales tienen prioridad)
                UPDATE SET FechaIndexacion = FechaIndexacion
            WHEN NOT MATCHED THEN
                INSERT (NumeroDocumento, FechaRegistro, StorageDisk, StoragePath)
                VALUES (@NumeroDocumento, '', '', 'FALTANTE');
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.ExecuteAsync(
            new CommandDefinition(sql, new { NumeroDocumento = numeroDocumento.Trim() }, cancellationToken: ct));

        _logger.LogDebug("Caché L2 faltante marcado: {NumeroDocumento}", numeroDocumento);
    }

    public async Task GuardarAsync(string numeroDocumento, SoporteDataItem item, CancellationToken ct = default)
    {
        // MERGE para insertar o actualizar (upsert) sin lanzar error de duplicado.
        const string sql = """
            MERGE DocumentosIndexados AS target
            USING (SELECT @NumeroDocumento AS NumeroDocumento) AS src
                ON target.NumeroDocumento = src.NumeroDocumento
            WHEN MATCHED THEN
                UPDATE SET FechaRegistro   = @FechaRegistro,
                           StorageDisk     = @StorageDisk,
                           StoragePath     = @StoragePath,
                           FechaIndexacion = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (NumeroDocumento, FechaRegistro, StorageDisk, StoragePath)
                VALUES (@NumeroDocumento, @FechaRegistro, @StorageDisk, @StoragePath);
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.ExecuteAsync(
            new CommandDefinition(sql, new
            {
                NumeroDocumento = numeroDocumento.Trim(),
                item.FechaRegistro,
                StorageDisk = item.Storage_Disk,
                StoragePath = item.Storage_Path
            }, cancellationToken: ct));

        _logger.LogDebug("Caché L2 guardado: {NumeroDocumento}", numeroDocumento);
    }

    public async Task<Dictionary<string, SoporteDataItem>> ObtenerBatchAsync(
        IEnumerable<string> numerosDocumento, CancellationToken ct = default)
    {
        var lista = numerosDocumento.Select(n => n.Trim()).Where(n => n.Length > 0).ToArray();
        if (lista.Length == 0)
            return new Dictionary<string, SoporteDataItem>(StringComparer.OrdinalIgnoreCase);

        // Trae tanto encontrados como faltantes (centinela FALTANTE) para evitar llamadas innecesarias al API.
        const string sql = """
            SELECT NumeroDocumento, FechaRegistro, StorageDisk, StoragePath
            FROM   DocumentosIndexados
            WHERE  NumeroDocumento IN @Lista
            """;

        await using var conn = new SqlConnection(_connectionString);
        var rows = await conn.QueryAsync<DocumentoBatchRow>(
            new CommandDefinition(sql, new { Lista = lista }, cancellationToken: ct));

        var resultado = rows.ToDictionary(
            r => r.NumeroDocumento,
            r => new SoporteDataItem(r.FechaRegistro ?? string.Empty, r.StorageDisk ?? string.Empty, r.StoragePath ?? string.Empty),
            StringComparer.OrdinalIgnoreCase);

        var encontrados = resultado.Count(kvp => kvp.Value.Storage_Path != FALTANTE_SENTINEL);
        var faltantes   = resultado.Count - encontrados;
        _logger.LogDebug("Caché L2 batch: {Encontrados} encontrados + {Faltantes} faltantes / {Total} consultados",
            encontrados, faltantes, lista.Length);

        return resultado;
    }

    // Clases internas para el mapeo de Dapper
    private sealed record DocumentoRow(string FechaRegistro, string StorageDisk, string StoragePath);
    private sealed record DocumentoBatchRow(string NumeroDocumento, string FechaRegistro, string StorageDisk, string StoragePath);
}
