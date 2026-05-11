using Microsoft.AspNetCore.Http;

namespace PunteoDomicilios.Web.DTOs;

public class ProcesarManualDto
{
    public List<ItemSoporteDto> Items { get; set; } = new();
}

public class ItemSoporteDto
{
    public string Soporte { get; set; } = string.Empty;
    public IFormFile? Archivo { get; set; }
}
