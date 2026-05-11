using Microsoft.AspNetCore.Mvc;
using PunteoDomicilios.Web.Services;

namespace PunteoDomicilios.Web.Controllers;

public static class SessionKeys
{
    public const string Usuario = "punteo_usuario";
}

[Route("login")]
public class LoginController : Controller
{
    private readonly IMensajeroService _mensajeroService;
    private readonly ILogger<LoginController> _logger;

    public LoginController(IMensajeroService mensajeroService, ILogger<LoginController> logger)
    {
        _mensajeroService = mensajeroService;
        _logger = logger;
    }

    [HttpGet("")]
    public IActionResult Index([FromQuery] bool cambiar = false)
    {
        if (cambiar)
            HttpContext.Session.Remove(SessionKeys.Usuario);

        // Si ya tiene sesión activa y no viene a cambiar, redirige al dashboard
        if (!cambiar && HttpContext.Session.GetString(SessionKeys.Usuario) is { Length: > 0 })
            return RedirectToAction("Index", "Dashboard");

        return View();
    }

    [HttpPost("")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Entrar([FromForm] string usuario)
    {
        if (string.IsNullOrWhiteSpace(usuario))
        {
            TempData["Error"] = "Ingresa tu nombre de usuario antes de continuar.";
            return RedirectToAction(nameof(Index));
        }

        var usuarioNorm = usuario.Trim().ToUpperInvariant();

        // Validar que el usuario exista en la base de datos
        var usuarios = await _mensajeroService.ObtenerUsuariosAsync();
        if (!usuarios.Any(u => u.Equals(usuarioNorm, StringComparison.OrdinalIgnoreCase)))
        {
            TempData["Error"] = $"El usuario '{usuarioNorm}' no existe en el sistema.";
            return RedirectToAction(nameof(Index));
        }

        HttpContext.Session.SetString(SessionKeys.Usuario, usuarioNorm);
        _logger.LogInformation("Usuario {Usuario} inició sesión", usuarioNorm);
        return RedirectToAction("Index", "Dashboard");
    }
}
