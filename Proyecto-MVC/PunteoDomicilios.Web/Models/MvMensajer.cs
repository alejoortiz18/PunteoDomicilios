namespace PunteoDomicilios.Web.Models;

public class MvMensajer
{
    public string Mensajero   { get; set; } = string.Empty;
    public DateTime Fecha     { get; set; }
    public string Nrodcto     { get; set; } = string.Empty;
    public string Destino     { get; set; } = string.Empty;
    public string Refrigera   { get; set; } = string.Empty;
    public decimal CuotaMod   { get; set; }
    public decimal Domicilio  { get; set; }
    public string Observacio  { get; set; } = string.Empty;
    public string NroConsig   { get; set; } = string.Empty;
    public decimal VlrConsig  { get; set; }
    public string NroPlanilla { get; set; } = string.Empty;
    public string Usuario     { get; set; } = string.Empty;
    public int Id             { get; set; }
}
