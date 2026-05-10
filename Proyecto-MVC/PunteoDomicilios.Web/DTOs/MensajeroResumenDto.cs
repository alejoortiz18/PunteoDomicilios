namespace PunteoDomicilios.Web.DTOs;

public record MensajeroResumenDto(
    string Usuario,
    DateOnly Fecha,
    int Total,
    int Encontrados,
    int Faltantes,
    int Errores
)
{
    public decimal PorcentajeCobertura =>
        Total == 0 ? 0 : Math.Round((decimal)Encontrados / Total * 100, 1);
}
