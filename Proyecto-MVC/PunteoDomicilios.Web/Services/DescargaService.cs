using System.Net;
using System.Text.RegularExpressions;

namespace PunteoDomicilios.Web.Services;

/// <summary>
/// Descarga PDFs de soporte desde intranet.helpharma.com.
/// Flujo: login con sesión Laravel → GET /ver-pdf/{path} → 302 a S3 signed URL → stream.
/// </summary>
public class DescargaService : IDescargaService
{
    private readonly HttpClient _http;
    private readonly string _email;
    private readonly string _password;
    private readonly ILogger<DescargaService> _logger;

    // Sesión compartida entre instancias (servicio Transient).
    // Se invalida al detectar que expiró (redirect a /login en lugar de a S3).
    private static string? _sessionCookie;
    private static readonly SemaphoreSlim _loginLock = new(1, 1);

    public DescargaService(HttpClient http, IConfiguration configuration, ILogger<DescargaService> logger)
    {
        _http = http;
        _logger = logger;
        var cfg = configuration.GetSection("DescargaInterna");
        _email    = cfg["Email"]    ?? cfg["Usuario"] ?? string.Empty;
        _password = cfg["Password"] ?? string.Empty;
    }

    public async Task<Stream?> ObtenerArchivoAsync(string storagePath, CancellationToken ct = default)
    {
        if (storagePath.Contains("..") || storagePath.Contains('\\'))
        {
            _logger.LogWarning("Path traversal bloqueado: {Path}", storagePath);
            return null;
        }

        // Intento 1: con sesión cacheada
        var stream = await DescargarConSesionAsync(storagePath, ct);
        if (stream != null) return stream;

        // Sesión expirada o inexistente — hacer login y reintentar una vez
        _logger.LogInformation("Sesión no disponible, iniciando login para descarga de {Path}", storagePath);
        var loginOk = await LoginAsync(ct);
        if (!loginOk)
        {
            _logger.LogError("No se pudo autenticar en el servidor de descargas");
            return null;
        }

        return await DescargarConSesionAsync(storagePath, ct);
    }

    // ── Descarga usando la sesión cacheada ──────────────────────────────────
    private async Task<Stream?> DescargarConSesionAsync(string storagePath, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_sessionCookie)) return null;

        try
        {
            // GET /ver-pdf/{path} sin seguir redirects automáticamente
            var req = new HttpRequestMessage(HttpMethod.Get, $"/ver-pdf/{storagePath}");
            req.Headers.Add("Cookie", _sessionCookie);

            var resp = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);

            // El servidor autentica → 302 a URL firmada de S3
            if (resp.StatusCode is HttpStatusCode.Found or HttpStatusCode.MovedPermanently)
            {
                var location = resp.Headers.Location;
                if (location != null && location.Host.Contains("amazonaws.com", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogDebug("Redirigido a S3: {Url}",
                        location.AbsoluteUri[..Math.Min(80, location.AbsoluteUri.Length)]);

                    // Seguir el redirect a S3 (URL absoluta con credenciales firmadas AWS)
                    var s3Req  = new HttpRequestMessage(HttpMethod.Get, location);
                    var s3Resp = await _http.SendAsync(s3Req, HttpCompletionOption.ResponseHeadersRead, ct);
                    s3Resp.EnsureSuccessStatusCode();

                    _logger.LogInformation("Descarga iniciada para {Path}", storagePath);
                    return await s3Resp.Content.ReadAsStreamAsync(ct);
                }

                // Redirect a /login → sesión expirada
                _logger.LogDebug("Sesión expirada (redirect a {Location})", location?.ToString() ?? "?");
                _sessionCookie = null;
                return null;
            }

            _logger.LogWarning("Respuesta inesperada de /ver-pdf/{Path}: {Status}", storagePath, resp.StatusCode);
            return null;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Error de red al descargar {Path}", storagePath);
            return null;
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogWarning(ex, "Timeout al descargar {Path}", storagePath);
            return null;
        }
    }

    // ── Login en intranet.helpharma.com (Laravel, CSRF + sesión cookie) ─────
    private async Task<bool> LoginAsync(CancellationToken ct)
    {
        await _loginLock.WaitAsync(CancellationToken.None);
        try
        {
            // Double-check: otra llamada concurrente puede haber completado el login
            if (!string.IsNullOrEmpty(_sessionCookie)) return true;

            // 1. GET /login → CSRF token (_token en el form) + cookie inicial
            var loginPageResp = await _http.GetAsync("/login", ct);
            var html = await loginPageResp.Content.ReadAsStringAsync(ct);

            var tokenMatch = Regex.Match(html, "name=\"_token\"\\s+value=\"([^\"]+)\"");
            if (!tokenMatch.Success)
            {
                _logger.LogError("CSRF token no encontrado en la página de login");
                return false;
            }
            var csrf = tokenMatch.Groups[1].Value;

            // Cookies del GET /login (sesión pre-login para el CSRF)
            var initCookies = loginPageResp.Headers.TryGetValues("Set-Cookie", out var ic)
                ? string.Join("; ", ic.Select(c => c.Split(';')[0]))
                : string.Empty;

            // 2. POST /login con credenciales y CSRF token
            var postReq = new HttpRequestMessage(HttpMethod.Post, "/login");
            postReq.Headers.Add("Cookie", initCookies);
            postReq.Headers.Referrer = new Uri("https://intranet.helpharma.com/login");
            postReq.Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["_token"]   = csrf,
                ["email"]    = _email,
                ["password"] = _password,
            });

            var loginResp = await _http.SendAsync(postReq, ct);

            if (loginResp.StatusCode is not (HttpStatusCode.Found or HttpStatusCode.MovedPermanently))
            {
                _logger.LogError("Login falló. Status: {Status}", loginResp.StatusCode);
                return false;
            }

            // 3. Capturar SOLO las cookies del POST login (contienen la sesión autenticada)
            if (!loginResp.Headers.TryGetValues("Set-Cookie", out var sc))
            {
                _logger.LogError("Login no retornó cookies de sesión");
                return false;
            }

            _sessionCookie = string.Join("; ", sc.Select(c => c.Split(';')[0]));
            _logger.LogInformation("Login exitoso en servidor de descargas");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error durante el login en servidor de descargas");
            return false;
        }
        finally
        {
            _loginLock.Release();
        }
    }
}

