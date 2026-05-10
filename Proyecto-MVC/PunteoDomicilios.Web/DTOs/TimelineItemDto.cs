namespace PunteoDomicilios.Web.DTOs;

public record TimelineItemDto(
    DateOnly Fecha,
    int Total,
    int Encontrados,
    int Faltantes
)
{
    public decimal PorcentajeCobertura =>
        Total == 0 ? 0 : Math.Round((decimal)Encontrados / Total * 100, 1);
}
