# =====================================================================
#  HELPHARMA - Convertir datos-ejemplo.xlsx a datos-reales.js
#  Ejecutar desde: PunteoDomicilios\Entradas\
#  Salida:         ..\prototipo\datos-reales.js
# =====================================================================
param(
  [string]$ExcelPath = ".\datos-ejemplo.xlsx",
  [string]$OutputJs  = "..\prototipo\datos-reales.js"
)

$ExcelPath = (Resolve-Path $ExcelPath).Path
$OutputJs  = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\prototipo\datos-reales.js"))

Write-Host "Leyendo Excel: $ExcelPath"
Write-Host "Salida JS    : $OutputJs"

# ── 1. Abrir Excel y guardar como CSV temporal ───────────────────
$csvTmp = [IO.Path]::Combine([IO.Path]::GetTempPath(), "punteo_tmp_$(Get-Random).csv")

$xl = New-Object -ComObject Excel.Application
$xl.Visible       = $false
$xl.DisplayAlerts = $false

try {
  $wb = $xl.Workbooks.Open($ExcelPath)
  $ws = $wb.Sheets.Item(1)
  Write-Host "Filas totales: $($ws.UsedRange.Rows.Count)"
  Write-Host "Guardando CSV temporal..."
  $wb.SaveAs($csvTmp, 6)   # 6 = xlCSV
  $wb.Close($false)
  Write-Host "CSV guardado: $csvTmp"
} finally {
  $xl.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($xl) | Out-Null
}

# 2. Leer CSV y agrupar por Usuario -> Fecha
Write-Host "Procesando CSV..."
$data = [System.Collections.Generic.Dictionary[string,object]]::new()

$reader = [System.IO.StreamReader]::new($csvTmp, [System.Text.Encoding]::Default)
$headerLine = $reader.ReadLine()
# Auto-detect separator (Spanish locale uses ; instead of ,)
$sep = if ($headerLine -match ';') { ";" } else { "," }
Write-Host "Separador detectado: '$sep'"
$header = $headerLine -split [regex]::Escape($sep)
Write-Host "Header: $($header -join ' | ')"

# Map column index by name
$idx = @{}
for ($i=0; $i -lt $header.Count; $i++) {
  $idx[$header[$i].Trim().Trim('"')] = $i
}

$iNrodcto    = $idx["Nrodcto"]
$iFecha      = $idx["Fecha"]
$iDestino    = $idx["Destino"]
$iCuotaMod   = $idx["CuotaMod"]
$iNroPlanilla= $idx["NroPlanilla"]
$iUsuario    = $idx["Usuario"]
$iId         = $idx["id"]

$processed = 0
while (-not $reader.EndOfStream) {
  $line = $reader.ReadLine()
  if (-not $line) { continue }

  # Simple split (no embedded separators expected in these fields)
  $cols = $line -split [regex]::Escape($sep)

  $usuario    = $cols[$iUsuario].Trim().Trim('"')
  $fechaRaw   = $cols[$iFecha].Trim().Trim('"')
  $nrodcto    = $cols[$iNrodcto].Trim().Trim('"')
  $destino    = $cols[$iDestino].Trim().Trim('"')
  $cuotaStr   = $cols[$iCuotaMod].Trim().Trim('"') -replace '\..*',''  # integer part
  $planilla   = $cols[$iNroPlanilla].Trim().Trim('"')
  $idStr      = $cols[$iId].Trim().Trim('"')

  if (-not $usuario -or -not $nrodcto) { continue }

  # Parse date - Excel CSV may be d/MM/yyyy
  $fechaISO = ""
  try {
    $parts = $fechaRaw -split "[/\-]"
    if ($parts.Count -eq 3) {
      if ($parts[2].Length -eq 4) {
        # d/MM/yyyy
        $fechaISO = "$($parts[2])-$($parts[1].PadLeft(2,'0'))-$($parts[0].PadLeft(2,'0'))"
      } else {
        # yyyy-MM-dd already
        $fechaISO = $fechaRaw
      }
    }
  } catch { }

  if (-not $fechaISO) { continue }

  if (-not $data.ContainsKey($usuario)) {
    $data[$usuario] = [System.Collections.Generic.Dictionary[string,object]]::new()
  }
  $udata = $data[$usuario]

  if (-not $udata.ContainsKey($fechaISO)) {
    $udata[$fechaISO] = [System.Collections.Generic.List[string]]::new()
  }

  $cuota = 0; [int]::TryParse($cuotaStr, [ref]$cuota) | Out-Null
  $idVal = 0; [int]::TryParse($idStr,    [ref]$idVal)  | Out-Null

  # Store as compact JSON array string: ["nrodcto","destino",cuota,"planilla",id]
  $ne = $nrodcto.Replace('\','\\').Replace('"','\"')
  $de = $destino.Replace('\','\\').Replace('"','\"')
  $pe = $planilla.Replace('\','\\').Replace('"','\"')
  $rec = '["' + $ne + '","' + $de + '",' + $cuota + ',"' + $pe + '",' + $idVal + ']'
  $udata[$fechaISO].Add($rec)

  $processed++
  if ($processed % 20000 -eq 0) { Write-Host "  Procesadas $processed filas..." }
}
$reader.Close()

Write-Host "Total procesadas: $processed filas"
Write-Host "Usuarios encontrados: $($data.Keys -join ', ')"

# Remove temp CSV
Remove-Item $csvTmp -Force -ErrorAction SilentlyContinue

# 3. Generar JS─────────
Write-Host "Generando JS..."
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine("// AUTO-GENERADO por convert-excel.ps1 - NO editar manualmente")
[void]$sb.AppendLine("// Estructura: DATOS_REALES[usuario][fecha_ISO] = [[nrodcto,destino,cuotaMod,nroPlanilla,id],...]")
[void]$sb.AppendLine("window.DATOS_REALES = {")

$userList = @($data.Keys | Sort-Object)
for ($ui=0; $ui -lt $userList.Count; $ui++) {
  $usuario = $userList[$ui]
  [void]$sb.Append('  "' + $usuario + '":{')
  $udata   = $data[$usuario]
  $dateList = @($udata.Keys | Sort-Object -Descending)  # most recent first
  for ($di=0; $di -lt $dateList.Count; $di++) {
    $fecha = $dateList[$di]
    $recs  = $udata[$fecha]
    [void]$sb.Append('"' + $fecha + '":[')
    [void]$sb.Append($recs -join ",")
    [void]$sb.Append("]")    
    if ($di -lt $dateList.Count - 1) { [void]$sb.Append(",") }
  }
  if ($ui -lt $userList.Count - 1) {
    [void]$sb.AppendLine("},")
  } else {
    [void]$sb.AppendLine("}")
  }
}
[void]$sb.AppendLine("};")

[IO.File]::WriteAllText($OutputJs, $sb.ToString(), [System.Text.Encoding]::UTF8)
$sizeKB = [Math]::Round((Get-Item $OutputJs).Length / 1KB)
Write-Host ("Archivo generado: " + $OutputJs + " (" + $sizeKB + " KB)")
Write-Host "Listo."
