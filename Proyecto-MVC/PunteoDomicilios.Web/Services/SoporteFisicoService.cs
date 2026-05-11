using System.Text.Json;
using PunteoDomicilios.Web.DTOs;

namespace PunteoDomicilios.Web.Services;

/// <summary>
/// Envía el PDF de soporte con metadatos clínicos a
/// intranet.helpharma.com/api/v1/soporte/fisico (Bearer token).
/// </summary>
public class SoporteFisicoService : ISoporteFisicoService
{
    private readonly HttpClient _http;
    private readonly ILogger<SoporteFisicoService> _logger;

    private static readonly JsonSerializerOptions _jsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public SoporteFisicoService(HttpClient http, ILogger<SoporteFisicoService> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<(bool Exito, string Mensaje)> EnviarAsync(
        string idSoporte,
        string rutaArchivoTemp,
        string nombreArchivoOriginal,
        SoporteClinicoDto datos,
        CancellationToken ct = default)
    {
        try
        {
            var pdfBytes = await File.ReadAllBytesAsync(rutaArchivoTemp, ct);

            using var form = new MultipartFormDataContent();

            // ── Campos de texto ──────────────────────────────────────────────
            form.Add(new StringContent(idSoporte),                                     "soporte");
            form.Add(new StringContent(ParseInt(datos.IdConvenio).ToString()),         "idConvenio");
            form.Add(new StringContent(datos.NombreConvenio   ?? string.Empty),        "nombreConvenio");
            form.Add(new StringContent(datos.Fecha            ?? string.Empty),        "fecha");
            form.Add(new StringContent(datos.IdBodega         ?? string.Empty),        "idBodega");
            form.Add(new StringContent(datos.NombreSede       ?? string.Empty),        "nombreSede");
            form.Add(new StringContent(datos.NombreActividad  ?? string.Empty),        "nombreActividad");
            form.Add(new StringContent(datos.TipoEntrega      ?? string.Empty),        "tipoEntrega");
            form.Add(new StringContent(datos.TipoPlan         ?? string.Empty),        "tipoPlan");
            form.Add(new StringContent(datos.IdCartera        ?? string.Empty),        "idCartera");
            form.Add(new StringContent(datos.NombrePaciente   ?? string.Empty),        "nombrePaciente");
            form.Add(new StringContent(datos.IdTipoId         ?? string.Empty),        "idTipoId");
            form.Add(new StringContent(datos.IdPaciente.ToString()),                   "idPaciente");
            form.Add(new StringContent(datos.Celular          ?? string.Empty),        "celular");
            form.Add(new StringContent(datos.Telefono         ?? string.Empty),        "telefono");
            form.Add(new StringContent(datos.Direccion        ?? string.Empty),        "direccion");
            form.Add(new StringContent(datos.Complemento      ?? string.Empty),        "complemento");
            form.Add(new StringContent(datos.Observacion      ?? string.Empty),        "observacion");
            form.Add(new StringContent(datos.ValorCM          ?? "0"),                 "valorCM");
            form.Add(new StringContent("system"),                                      "idUsuario");

            // ── Medicamentos serializados a JSON ──────────────────────────────
            var meds = datos.Medicamentos is { Count: > 0 }
                ? JsonSerializer.Serialize(datos.Medicamentos, _jsonOpts)
                : "[]";
            form.Add(new StringContent(meds), "medicamentos");

            // ── Archivo PDF ──────────────────────────────────────────────────
            var pdfContent = new ByteArrayContent(pdfBytes);
            pdfContent.Headers.ContentType =
                new System.Net.Http.Headers.MediaTypeHeaderValue("application/pdf");
            form.Add(pdfContent, "anexo", nombreArchivoOriginal);

            // ── Envío ────────────────────────────────────────────────────────
            var response = await _http.PostAsync("/api/v1/soporte/fisico", form, ct);
            var contenido = await response.Content.ReadAsStringAsync(ct);

            var msn = ParseMensaje(contenido,
                response.IsSuccessStatusCode ? "OK" : response.StatusCode.ToString());

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("SoporteFisicoOK | Soporte={Soporte}", idSoporte);
                return (true, msn);
            }

            _logger.LogError(
                "SoporteFisicoError | Soporte={Soporte} | Status={Status} | Resp={Resp}",
                idSoporte, (int)response.StatusCode, contenido);

            return (false, msn);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SoporteFisicoException | Soporte={Soporte}", idSoporte);
            return (false, ex.Message);
        }
    }

    private static int ParseInt(string? value)
    {
        if (int.TryParse(value, out var n)) return n;
        return 0;
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
        catch { /* JSON inválido */ }

        return string.IsNullOrWhiteSpace(json) ? fallback : json;
    }
}
