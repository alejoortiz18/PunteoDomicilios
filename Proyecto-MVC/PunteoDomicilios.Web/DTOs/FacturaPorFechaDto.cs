namespace PunteoDomicilios.Web.DTOs;

/// <summary>Factura/documento obtenido por fecha desde el ERP (TRADE).</summary>
public class FacturaPorFechaDto
{
    public string? OrdenEntMv    { get; init; }
    public string? TipoFactura   { get; init; }
    public string? DctoMae       { get; init; }
    public string? Prefijo       { get; init; }
    public string? TipoDcto      { get; init; }
    public string? NroDcto       { get; init; }
    public string? TipoDc        { get; init; }
    public string? Nit           { get; init; }
    public string? FechaFactura  { get; init; }
    public string? FechaOrden    { get; init; }
    public string? TipoCar       { get; init; }
    public string? NombreCartera { get; init; }
    public string? CtaCobro      { get; init; }
    /// <summary>Clave para consultar soporte en la API interna.</summary>
    public string? DctoPrv       { get; init; }
}
