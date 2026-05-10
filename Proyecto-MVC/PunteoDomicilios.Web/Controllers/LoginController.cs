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
    public async Task<IActionResult> Index([FromQuery] bool cambiar = false)
    {
        if (cambiar)
            HttpContext.Session.Remove(SessionKeys.Usuario);

        // Si ya tiene sesión activa y no viene a cambiar, redirige al dashboard
        if (!cambiar && HttpContext.Session.GetString(SessionKeys.Usuario) is { Length: > 0 })
            return RedirectToAction("Index", "Dashboard");

        var usuarios = (await _mensajeroService.ObtenerUsuariosAsync()).ToList();
        return View(usuarios);
    }

    [HttpPost("")]
    [ValidateAntiForgeryToken]
    public IActionResult Entrar([FromForm] string usuario)
    {
        if (string.IsNullOrWhiteSpace(usuario))
        {
            TempData["Error"] = "Selecciona un usuario antes de continuar.";
            return RedirectToAction(nameof(Index));
        }

        HttpContext.Session.SetString(SessionKeys.Usuario, usuario.Trim());
        _logger.LogInformation("Usuario {Usuario} inició sesión", usuario);
        return RedirectToAction("Index", "Dashboard");
    }
}
