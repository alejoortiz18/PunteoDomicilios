using PunteoDomicilios.Web.DTOs;
using PunteoDomicilios.Web.Models;

namespace PunteoDomicilios.Web.Repositories;

public interface IMensajeroRepository
{
    Task<IEnumerable<string>> ObtenerUsuariosAsync();
    Task<IEnumerable<MvMensajer>> ObtenerRegistrosAsync(string usuario, DateOnly fecha);
    Task<IEnumerable<TimelineItemDto>> ObtenerTimelineAsync(string usuario, int dias);
    Task<IEnumerable<ResumenMensualDto>> ObtenerResumenMensualAsync(string usuario);
    Task<IEnumerable<DiaMesDto>> ObtenerDiasDelMesAsync(string usuario, string mes);
}
