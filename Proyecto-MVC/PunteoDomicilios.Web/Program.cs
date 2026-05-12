using System.Net;
using PunteoDomicilios.Web.Middleware;
using PunteoDomicilios.Web.Repositories;
using PunteoDomicilios.Web.Services;
using Serilog;

// ── Logging con Serilog ───────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Serilog desde appsettings.json
    builder.Host.UseSerilog((ctx, services, cfg) => cfg
        .ReadFrom.Configuration(ctx.Configuration)
        .ReadFrom.Services(services)
        .WriteTo.Console()
        .WriteTo.File("logs/punteo-.txt",
            rollingInterval: RollingInterval.Day,
            retainedFileCountLimit: 30));

    // ── MVC ──────────────────────────────────────────────────────────────────
    builder.Services.AddControllersWithViews();
    builder.Services.AddMemoryCache();

    // ── Sesión (equivalente al sessionStorage del prototipo) ──────────────────
    builder.Services.AddDistributedMemoryCache();
    builder.Services.AddSession(options =>
    {
        options.Cookie.Name = ".PunteoDomicilios.Session";
        options.IdleTimeout = TimeSpan.FromHours(8);
        options.Cookie.HttpOnly = true;
        options.Cookie.IsEssential = true;
    });

    // ── Repositorios y Servicios ──────────────────────────────────────────────
    builder.Services.AddScoped<IMensajeroRepository, MensajeroRepository>();
    builder.Services.AddScoped<IMensajeroService, MensajeroService>();
    builder.Services.AddSingleton<IDocumentoCacheRepository, SqlDocumentoCacheRepository>();

    // ── HttpClient API interna (con retry y timeout) ──────────────────────────
    var apiConfig = builder.Configuration.GetSection("ApiInterna");
    var timeoutSeconds = apiConfig.GetValue("TimeoutSeconds", 10);
    var retryCount = apiConfig.GetValue("RetryCount", 2);
    var token = apiConfig["Token"] ?? string.Empty;
    var apiBaseUrl = apiConfig["BaseUrl"] ?? throw new InvalidOperationException("ApiInterna:BaseUrl no configurado.");

    builder.Services.AddHttpClient<ISoporteApiService, SoporteApiService>(client =>
    {
        client.BaseAddress = new Uri(apiBaseUrl);
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds + (retryCount * timeoutSeconds));
        if (!string.IsNullOrWhiteSpace(token))
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
    })
    .AddStandardResilienceHandler(options =>
    {
        options.Retry.MaxRetryAttempts = retryCount;
        options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
    });

    // ── HttpClient Descarga (login Laravel + S3 redirect) ────────────────────
    var descargaConfig = builder.Configuration.GetSection("DescargaInterna");
    var descargaBaseUrl = descargaConfig["BaseUrl"] ?? apiBaseUrl;

    builder.Services.AddHttpClient<IDescargaService, DescargaService>(client =>
    {
        client.BaseAddress = new Uri(descargaBaseUrl);
    })
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        // AllowAutoRedirect = false es esencial: /ver-pdf/ hace 302 a S3,
        // necesitamos capturar el Location header para seguirlo explícitamente.
        AllowAutoRedirect = false,
        UseCookies = false,  // Cookies manejadas manualmente en DescargaService
    });
    // ── HttpClient API Soportes (consulta datos clínicos) ────────────────────
    var soportesConfig = builder.Configuration.GetSection("ApiSoportes");
    var soportesBaseUrl = soportesConfig["BaseUrl"] ?? throw new InvalidOperationException("ApiSoportes:BaseUrl no configurado.");
    var soportesApiKey  = soportesConfig["ApiKey"]  ?? string.Empty;
    var soportesTimeout = soportesConfig.GetValue("TimeoutSeconds", 30);

    builder.Services.AddHttpClient<ISoporteDatosService, SoporteDatosService>(client =>
    {
        client.BaseAddress = new Uri(soportesBaseUrl);
        client.Timeout = TimeSpan.FromSeconds(soportesTimeout);
        if (!string.IsNullOrWhiteSpace(soportesApiKey))
            client.DefaultRequestHeaders.Add("X-API-KEY", soportesApiKey);
    });

    // ── HttpClient Soporte Físico (envío multipart a ApiInterna) ─────────────
    var fisicoTimeout = apiConfig.GetValue("FisicoTimeoutSeconds", 120);
    builder.Services.AddHttpClient<ISoporteFisicoService, SoporteFisicoService>(client =>
    {
        client.BaseAddress = new Uri(apiBaseUrl);
        client.Timeout = TimeSpan.FromSeconds(fisicoTimeout);
        if (!string.IsNullOrWhiteSpace(token))
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
    });
    // ── Build ─────────────────────────────────────────────────────────────────
    var app = builder.Build();

    app.UseMiddleware<GlobalExceptionMiddleware>();

    if (!app.Environment.IsDevelopment())
    {
        app.UseHsts();
    }

    app.UseHttpsRedirection();
    app.UseStaticFiles();
    app.UseRouting();
    app.UseSession();
    app.UseAuthorization();

    app.MapControllerRoute(
        name: "default",
        pattern: "{controller=Dashboard}/{action=Index}/{id?}");

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "La aplicación falló al iniciar");
}
finally
{
    Log.CloseAndFlush();
}
