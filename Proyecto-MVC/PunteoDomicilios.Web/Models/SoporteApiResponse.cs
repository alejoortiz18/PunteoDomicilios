namespace PunteoDomicilios.Web.Models;

public record SoporteApiResponse(
    bool Success,
    string? Message,
    List<SoporteDataItem>? Data
);

public record SoporteDataItem(
    string FechaRegistro,
    string Storage_Disk,
    string Storage_Path
);
