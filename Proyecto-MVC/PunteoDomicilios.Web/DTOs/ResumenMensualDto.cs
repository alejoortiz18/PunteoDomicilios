namespace PunteoDomicilios.Web.DTOs;

public record ResumenMensualDto(
    string Mes,        // "2026-05"
    string Label,      // "Mayo 2026"
    int TotalRegistros,
    int TotalPlanillas,
    int CantidadDias   // Días distintos con registros en ese mes
);
