using PunteoDomicilios.Web.Models;

namespace PunteoDomicilios.Web.DTOs;

public record NrodctoEstadoDto(
    string Nrodcto,
    EstadoSoporte Estado,
    string? FechaRegistro,
    string? StorageDisk,
    string? StoragePath,
    string? MensajeError
);
