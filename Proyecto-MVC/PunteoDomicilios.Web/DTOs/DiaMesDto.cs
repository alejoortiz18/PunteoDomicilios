namespace PunteoDomicilios.Web.DTOs;

public record DiaMesDto(
    DateOnly Fecha,
    int TotalRegistros,
    int TotalPlanillas
);
