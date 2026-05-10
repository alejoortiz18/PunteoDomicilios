using Dapper;
using Microsoft.Data.SqlClient;
using PunteoDomicilios.Web.DTOs;
using PunteoDomicilios.Web.Models;

namespace PunteoDomicilios.Web.Repositories;

public class MensajeroRepository : IMensajeroRepository
{
    private readonly string _connectionString;
    private readonly ILogger<MensajeroRepository> _logger;

    public MensajeroRepository(IConfiguration configuration, ILogger<MensajeroRepository> logger)
    {
        _connectionString = configuration.GetConnectionString("Helpharma")
            ?? throw new InvalidOperationException("ConnectionString 'Helpharma' no configurado.");
        _logger = logger;
    }

    public async Task<IEnumerable<string>> ObtenerUsuariosAsync()
    {
        const string sql = "SELECT DISTINCT RTRIM(Usuario) AS Usuario FROM MvMensajer ORDER BY RTRIM(Usuario)";

        await using var conn = new SqlConnection(_connectionString);
        _logger.LogDebug("Obteniendo lista de usuarios únicos");
        return await conn.QueryAsync<string>(sql);
    }

    public async Task<IEnumerable<MvMensajer>> ObtenerRegistrosAsync(string usuario, DateOnly fecha)
    {
        const string sql = """
            SELECT Mensajero, Fecha, Nrodcto, Destino, Refrigera,
                   CuotaMod, Domicilio, Observacio, NroConsig, VlrConsig,
                   NroPlanilla, Usuario, Id
            FROM MvMensajer
            WHERE Usuario = @Usuario
              AND CAST(Fecha AS DATE) = @Fecha
            """;

        await using var conn = new SqlConnection(_connectionString);
        _logger.LogDebug("Obteniendo registros para {Usuario} en {Fecha}", usuario, fecha);
        return await conn.QueryAsync<MvMensajer>(sql, new { Usuario = usuario, Fecha = fecha.ToDateTime(TimeOnly.MinValue) });
    }

    public async Task<IEnumerable<TimelineItemDto>> ObtenerTimelineAsync(string usuario, int dias)
    {
        const string sql = """
            SELECT
                CAST(Fecha AS DATE)           AS Fecha,
                COUNT(DISTINCT Nrodcto)       AS Total,
                0                             AS Encontrados,
                0                             AS Faltantes
            FROM MvMensajer
            WHERE Usuario = @Usuario
              AND Fecha >= DATEADD(DAY, -@Dias, CAST(GETDATE() AS DATE))
            GROUP BY CAST(Fecha AS DATE)
            ORDER BY CAST(Fecha AS DATE) ASC
            """;

        await using var conn = new SqlConnection(_connectionString);
        _logger.LogDebug("Obteniendo timeline para {Usuario}, últimos {Dias} días", usuario, dias);

        var rows = await conn.QueryAsync(sql, new { Usuario = usuario, Dias = dias });

        return rows.Select(r => new TimelineItemDto(
            DateOnly.FromDateTime((DateTime)r.Fecha),
            (int)r.Total,
            (int)r.Encontrados,
            (int)r.Faltantes
        ));
    }

    public async Task<IEnumerable<ResumenMensualDto>> ObtenerResumenMensualAsync(string usuario)
    {
        const string sql = """
            SELECT
                FORMAT(Fecha, 'yyyy-MM')         AS Mes,
                COUNT(*)                          AS TotalRegistros,
                COUNT(DISTINCT NroPlanilla)       AS TotalPlanillas
            FROM MvMensajer
            WHERE Usuario = @Usuario
            GROUP BY FORMAT(Fecha, 'yyyy-MM')
            ORDER BY Mes DESC
            """;

        await using var conn = new SqlConnection(_connectionString);
        _logger.LogDebug("Obteniendo resumen mensual para {Usuario}", usuario);

        var rows = await conn.QueryAsync(sql, new { Usuario = usuario });

        return rows.Select(r =>
        {
            string mes = (string)r.Mes;
            var label = FormatMesLabel(mes);
            return new ResumenMensualDto(mes, label, (int)r.TotalRegistros, (int)r.TotalPlanillas);
        });
    }

    public async Task<IEnumerable<DiaMesDto>> ObtenerDiasDelMesAsync(string usuario, string mes)
    {
        // mes format: "yyyy-MM"
        const string sql = """
            SELECT
                CAST(Fecha AS DATE)              AS Fecha,
                COUNT(*)                          AS TotalRegistros,
                COUNT(DISTINCT NroPlanilla)       AS TotalPlanillas
            FROM MvMensajer
            WHERE Usuario = @Usuario
              AND FORMAT(Fecha, 'yyyy-MM') = @Mes
            GROUP BY CAST(Fecha AS DATE)
            ORDER BY CAST(Fecha AS DATE) DESC
            """;

        await using var conn = new SqlConnection(_connectionString);
        _logger.LogDebug("Obteniendo días del mes {Mes} para {Usuario}", mes, usuario);

        var rows = await conn.QueryAsync(sql, new { Usuario = usuario, Mes = mes });

        return rows.Select(r => new DiaMesDto(
            DateOnly.FromDateTime((DateTime)r.Fecha),
            (int)r.TotalRegistros,
            (int)r.TotalPlanillas
        ));
    }

    private static string FormatMesLabel(string mesISO)
    {
        var parts = mesISO.Split('-');
        if (parts.Length != 2) return mesISO;
        var nombres = new[] { "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                                  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre" };
        if (!int.TryParse(parts[1], out int m) || m < 1 || m > 12) return mesISO;
        return $"{nombres[m]} {parts[0]}";
    }
}
