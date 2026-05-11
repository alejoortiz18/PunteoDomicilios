using System.Net.Http.Json;
using System.Text.Json;
using PunteoDomicilios.Web.DTOs;

namespace PunteoDomicilios.Web.Services;

/// <summary>
/// Consulta los datos clínicos de un soporte en la API externa
/// api-soportes.helpharma.com.co. Usa X-API-KEY (no Bearer).
/// </summary>
public class SoporteDatosService : ISoporteDatosService
{
    private readonly HttpClient _http;
    private readonly ILogger<SoporteDatosService> _logger;

    private static readonly JsonSerializerOptions _jsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public SoporteDatosService(HttpClient http, ILogger<SoporteDatosService> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<(SoporteClinicoDto? Datos, string Mensaje)> ObtenerDatosAsync(
        string idSoporte, CancellationToken ct = default)
    {
        try
        {
            var body = new { soporte = idSoporte };
            var response = await _http.PostAsJsonAsync(
                "/api/DocSoporte/soportes/DatosSoportes", body, ct);

            var contenido = await response.Content.ReadAsStringAsync(ct);

            if (response.IsSuccessStatusCode)
            {
                var datos = JsonSerializer.Deserialize<SoporteClinicoDto>(contenido, _jsonOpts);
                _logger.LogInformation(
                    "SoporteDatosOK | Soporte={Soporte} | Paciente={Paciente}",
                    idSoporte, datos?.NombrePaciente ?? "(sin nombre)");

                return (datos, ParseMensaje(contenido, "OK"));
            }

            var msn = ParseMensaje(contenido, response.StatusCode.ToString());
            _logger.LogError(
                "SoporteDatosError | Soporte={Soporte} | Status={Status} | Resp={Resp}",
                idSoporte, (int)response.StatusCode, contenido);

            return (null, msn);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SoporteDatosException | Soporte={Soporte}", idSoporte);
            return (null, ex.Message);
        }
    }

    private static string ParseMensaje(string json, string fallback)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("message", out var msg) &&
                msg.ValueKind == JsonValueKind.String)
                return msg.GetString() ?? fallback;

            if (doc.RootElement.TryGetProperty("errors", out var err))
                return err.ToString();
        }
        catch { /* JSON inválido — usamos el cuerpo crudo */ }

        return string.IsNullOrWhiteSpace(json) ? fallback : json;
    }
}
