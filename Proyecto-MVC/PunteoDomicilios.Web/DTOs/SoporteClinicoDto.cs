using System.Text.Json.Serialization;

namespace PunteoDomicilios.Web.DTOs;

/// <summary>
/// Respuesta de la API de soportes (api-soportes.helpharma.com.co).
/// Todos los campos son opcionales porque la API puede devolver nulos.
/// </summary>
public class SoporteClinicoDto
{
    [JsonPropertyName("idConvenio")]
    public string? IdConvenio { get; set; }

    [JsonPropertyName("nombreConvenio")]
    public string? NombreConvenio { get; set; }

    [JsonPropertyName("fecha")]
    public string? Fecha { get; set; }

    [JsonPropertyName("idBodega")]
    public string? IdBodega { get; set; }

    [JsonPropertyName("nombreSede")]
    public string? NombreSede { get; set; }

    [JsonPropertyName("nombreActividad")]
    public string? NombreActividad { get; set; }

    [JsonPropertyName("tipoEntrega")]
    public string? TipoEntrega { get; set; }

    [JsonPropertyName("tipoPlan")]
    public string? TipoPlan { get; set; }

    [JsonPropertyName("idCartera")]
    public string? IdCartera { get; set; }

    [JsonPropertyName("nombrePaciente")]
    public string? NombrePaciente { get; set; }

    [JsonPropertyName("idTipoId")]
    public string? IdTipoId { get; set; }

    [JsonPropertyName("idPaciente")]
    public int IdPaciente { get; set; }

    [JsonPropertyName("celular")]
    public string? Celular { get; set; }

    [JsonPropertyName("telefono")]
    public string? Telefono { get; set; }

    [JsonPropertyName("direccion")]
    public string? Direccion { get; set; }

    [JsonPropertyName("complemento")]
    public string? Complemento { get; set; }

    [JsonPropertyName("observacion")]
    public string? Observacion { get; set; }

    [JsonPropertyName("valorCM")]
    public string? ValorCM { get; set; }

    [JsonPropertyName("medicamentos")]
    public List<MedicamentoClfDto>? Medicamentos { get; set; }
}

public class MedicamentoClfDto
{
    [JsonPropertyName("ordenes")]
    public string? Ordenes { get; set; }

    [JsonPropertyName("producto")]
    public string? Producto { get; set; }

    [JsonPropertyName("nombre")]
    public string? Nombre { get; set; }

    [JsonPropertyName("cantidad")]
    public int Cantidad { get; set; }

    [JsonPropertyName("lote")]
    public string? Lote { get; set; }

    [JsonPropertyName("valorMx")]
    public decimal ValorMx { get; set; }
}
