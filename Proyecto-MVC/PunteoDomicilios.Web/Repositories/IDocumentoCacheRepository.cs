using PunteoDomicilios.Web.Models;

namespace PunteoDomicilios.Web.Repositories;

/// <summary>
/// Caché L2 persistente de respuestas del API de soportes (encontrados y faltantes).
/// </summary>
public interface IDocumentoCacheRepository
{
    /// <summary>
    /// Busca un documento previamente indexado. Retorna null si no existe en caché.
    /// Si fue consultado y no existe soporte, retorna SoporteDataItem con StoragePath = "FALTANTE".
    /// </summary>
    Task<SoporteDataItem?> ObtenerAsync(string numeroDocumento, CancellationToken ct = default);

    /// <summary>
    /// Guarda o actualiza la respuesta exitosa del API para un documento encontrado.
    /// </summary>
    Task GuardarAsync(string numeroDocumento, SoporteDataItem item, CancellationToken ct = default);

    /// <summary>
    /// Registra que el documento fue consultado y el API confirmó que NO existe soporte.
    /// </summary>
    Task MarcarFaltanteAsync(string numeroDocumento, CancellationToken ct = default);

    /// <summary>
    /// Busca en lote documentos previamente indexados (encontrados y faltantes) con una sola consulta SQL.
    /// Retorna un diccionario NumeroDocumento → SoporteDataItem para los que están en caché.
    /// Los faltantes tendrán StoragePath = "FALTANTE".
    /// </summary>
    Task<Dictionary<string, SoporteDataItem>> ObtenerBatchAsync(IEnumerable<string> numerosDocumento, CancellationToken ct = default);
}
