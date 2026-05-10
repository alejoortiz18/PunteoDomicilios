using System.Net;
using System.Text.Json;

namespace PunteoDomicilios.Web.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Excepción no manejada en {Method} {Path}",
                context.Request.Method, context.Request.Path);

            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

        // Si es una petición AJAX / JSON, responder con JSON
        if (context.Request.Headers.Accept.Any(h => h != null && h.Contains("application/json")) ||
            context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.ContentType = "application/json";
            var result = JsonSerializer.Serialize(new
            {
                error = "Ocurrió un error inesperado. Por favor intente nuevamente."
            });
            await context.Response.WriteAsync(result);
        }
        else
        {
            context.Response.Redirect("/Home/Error");
        }
    }
}
