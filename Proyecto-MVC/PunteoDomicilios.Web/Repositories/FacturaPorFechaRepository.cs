using Dapper;
using System.Data.SqlClient;
using PunteoDomicilios.Web.DTOs;

namespace PunteoDomicilios.Web.Repositories;

public class FacturaPorFechaRepository : IFacturaPorFechaRepository
{
    private readonly string _connectionString;
    private readonly ILogger<FacturaPorFechaRepository> _logger;

    public FacturaPorFechaRepository(
        IConfiguration configuration,
        ILogger<FacturaPorFechaRepository> logger)
    {
        _connectionString = configuration.GetConnectionString("Helpharma")
            ?? throw new InvalidOperationException("ConnectionString 'Helpharma' no configurado.");
        _logger = logger;
    }

    public async Task<IReadOnlyList<string>> ObtenerNombresCarteraAsync(CancellationToken ct = default)
    {
        const string sql = """
            SELECT DISTINCT K.NOMBRE AS Nombre
            FROM TIPOCAR K
            WHERE K.NOMBRE IS NOT NULL AND LTRIM(RTRIM(K.NOMBRE)) <> ''
            ORDER BY K.NOMBRE DESC
            """;

        await using var conn = new SqlConnection(_connectionString);
        var rows = await conn.QueryAsync<string>(new CommandDefinition(sql, cancellationToken: ct));
        return rows
            .Select(n => n?.Trim())
            .Where(n => !string.IsNullOrEmpty(n))
            .Cast<string>()
            .ToList();
    }

    public async Task<IEnumerable<FacturaPorFechaDto>> ObtenerFacturasPorFechaAsync(
        DateOnly fecha,
        string nombreCartera,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(nombreCartera))
            throw new ArgumentException("El nombre de cartera es obligatorio.", nameof(nombreCartera));

        var cartera = nombreCartera.Trim();
        _logger.LogDebug(
            "Consultando facturas | Fecha={Fecha} | Cartera={Cartera}",
            fecha, cartera);

        try
        {
            return await EjecutarConsultaAsync(incluirPrefijo: true, fecha, cartera, ct);
        }
        catch (SqlException ex)
        {
            _logger.LogWarning(ex,
                "Fallo SQL con GS_HP_BuscarPrefijo; reintentando sin prefijo | Fecha={Fecha} | Cartera={Cartera}",
                fecha, cartera);
            return await EjecutarConsultaAsync(incluirPrefijo: false, fecha, cartera, ct);
        }
    }

    private async Task<IEnumerable<FacturaPorFechaDto>> EjecutarConsultaAsync(
        bool incluirPrefijo,
        DateOnly fecha,
        string nombreCartera,
        CancellationToken ct)
    {
        await using var conn = new SqlConnection(_connectionString);

        var prefijoExpr = incluirPrefijo
            ? "dbo.GS_HP_BuscarPrefijo(T.ORIGEN, TD.DCTOMAE, T.TIPODCTO)"
            : "NULL";

        var sql = $$"""
            SELECT DISTINCT
                M.ORDENENTMV                                                        AS OrdenEntMv,
                CASE WHEN TD.DCTOMAE = 'FA' THEN 'DIRECTA' ELSE 'REMISIONADA' END  AS TipoFactura,
                TD.DCTOMAE                                                          AS DctoMae,
                {{prefijoExpr}}                                                     AS Prefijo,
                T.TIPODCTO                                                          AS TipoDcto,
                T.NRODCTO                                                           AS NroDcto,
                C.TIPODC                                                            AS TipoDc,
                T.NIT                                                               AS Nit,
                CAST(T.FECHA AS DATE)                                               AS FechaFactura,
                T.TIPOCAR                                                           AS TipoCar,
                K.NOMBRE                                                            AS NombreCartera,
                T.DCTOPRV                                                           AS DctoPrv
            FROM TRADE T
            LEFT JOIN MVTRADE M
                ON T.ORIGEN   = M.ORIGEN
                AND T.TIPODCTO = M.TIPODCTO
                AND T.NRODCTO  = M.NRODCTO
            LEFT JOIN TRADEMAS TM
                ON T.TIPODCTO = TM.TIPODCTO
                AND T.NRODCTO  = TM.NRODCTO
            LEFT JOIN MTPROCLI C
                ON T.NIT = C.NIT
            LEFT JOIN TIPOCAR K
                ON T.TIPOCAR = K.CODTC
            INNER JOIN TIPODCTO TD
                ON TD.TIPODCTO = M.TIPODCTO
                AND TD.ORIGEN  = M.ORIGEN
            WHERE TD.DCTOMAE IN ('FR','FA')
              AND CAST(T.FECHA AS DATE) = @Fecha
              AND K.NOMBRE = @NombreCartera
            ORDER BY TipoFactura ASC
            """;

        var rows = await conn.QueryAsync(
            new CommandDefinition(
                sql,
                new
                {
                    Fecha = fecha.ToDateTime(TimeOnly.MinValue),
                    NombreCartera = nombreCartera,
                },
                commandTimeout: 60,
                cancellationToken: ct));

        return rows.Select(MapRow);
    }

    private static FacturaPorFechaDto MapRow(dynamic r)
    {
        var d = (IDictionary<string, object>)r;
        string? S(string k) =>
            d.TryGetValue(k, out var v) && v is not null and not DBNull ? v.ToString()?.Trim() : null;
        string? D(string k) =>
            d.TryGetValue(k, out var v) && v is DateTime dt ? dt.ToString("yyyy-MM-dd") : null;

        return new FacturaPorFechaDto
        {
            OrdenEntMv    = S("OrdenEntMv"),
            TipoFactura   = S("TipoFactura"),
            DctoMae       = S("DctoMae"),
            Prefijo       = S("Prefijo"),
            TipoDcto      = S("TipoDcto"),
            NroDcto       = S("NroDcto"),
            TipoDc        = S("TipoDc"),
            Nit           = S("Nit"),
            FechaFactura  = D("FechaFactura"),
            TipoCar       = S("TipoCar"),
            NombreCartera = S("NombreCartera"),
            DctoPrv       = S("DctoPrv"),
        };
    }
}
