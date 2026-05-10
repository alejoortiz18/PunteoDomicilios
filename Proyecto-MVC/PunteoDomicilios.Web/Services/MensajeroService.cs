using PunteoDomicilios.Web.DTOs;
using PunteoDomicilios.Web.Models;
using PunteoDomicilios.Web.Repositories;

namespace PunteoDomicilios.Web.Services;

public class MensajeroService : IMensajeroService
{
    private readonly IMensajeroRepository _repository;
    private readonly ILogger<MensajeroService> _logger;

    public MensajeroService(IMensajeroRepository repository, ILogger<MensajeroService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public Task<IEnumerable<string>> ObtenerUsuariosAsync()
        => _repository.ObtenerUsuariosAsync();

    public Task<IEnumerable<MvMensajer>> ObtenerRegistrosAsync(string usuario, DateOnly fecha)
        => _repository.ObtenerRegistrosAsync(usuario, fecha);

    public Task<IEnumerable<TimelineItemDto>> ObtenerTimelineAsync(string usuario, int dias = 7)
        => _repository.ObtenerTimelineAsync(usuario, dias);

    public Task<IEnumerable<ResumenMensualDto>> ObtenerResumenMensualAsync(string usuario)
        => _repository.ObtenerResumenMensualAsync(usuario);

    public Task<IEnumerable<DiaMesDto>> ObtenerDiasDelMesAsync(string usuario, string mes)
        => _repository.ObtenerDiasDelMesAsync(usuario, mes);
}
