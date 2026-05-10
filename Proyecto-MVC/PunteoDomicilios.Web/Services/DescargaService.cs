namespace PunteoDomicilios.Web.Services;

public class DescargaService : IDescargaService
{
    private readonly HttpClient _http;
    private readonly ILogger<DescargaService> _logger;

    public DescargaService(HttpClient http, ILogger<DescargaService> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<Stream?> ObtenerArchivoAsync(string storagePath, CancellationToken ct = default)
    {
        // Protección contra path traversal
        if (storagePath.Contains("..") || storagePath.Contains("\\"))
        {
            _logger.LogWarning("Intento de path traversal bloqueado: {Path}", storagePath);
            return null;
        }

        try
        {
            var url = $"/ver-pdf/{Uri.EscapeDataString(storagePath)}";
            var response = await _http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
            response.EnsureSuccessStatusCode();

            _logger.LogInformation("Descarga iniciada para {Path}", storagePath);
            return await response.Content.ReadAsStreamAsync(ct);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Error descargando archivo {Path}", storagePath);
            return null;
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogWarning(ex, "Timeout descargando archivo {Path}", storagePath);
            return null;
        }
    }
}
