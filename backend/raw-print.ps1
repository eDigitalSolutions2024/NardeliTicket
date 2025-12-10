param(
    [string]$PrinterName = "ZDesigner GC420t",
    [string]$FilePath = "C:\Users\notar\Desktop\test_epl.txt"
)

# Solo definimos el tipo si aún no existe
if (-not ("RawPrinterHelper" -as [type])) {

    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] data, int buf, out int pcWritten);

    public static bool SendStringToPrinter(string printerName, string data)
    {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            return false;

        try
        {
            DOCINFOA di = new DOCINFOA();
            di.pDocName = "RAW_" + DateTime.Now.ToString("yyyyMMddHHmmss");
            di.pDataType = "RAW";

            if (!StartDocPrinter(hPrinter, 1, di))
                return false;
            if (!StartPagePrinter(hPrinter))
                return false;

            byte[] bytes = System.Text.Encoding.ASCII.GetBytes(data);
            int written;
            if (!WritePrinter(hPrinter, bytes, bytes.Length, out written))
                return false;

            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
            return true;
        }
        finally
        {
            ClosePrinter(hPrinter);
        }
    }
}
"@
}

if (-not (Test-Path $FilePath)) {
    Write-Host "El archivo $FilePath no existe"
    exit 1
}

# Leer EPL
$epl = Get-Content $FilePath -Raw

# Asegurar salto de línea final
if (-not $epl.EndsWith("`r`n")) {
    $epl += "`r`n"
}

# Limpiar buffer de la Zebra
$epl = "N`r`n" + $epl

$ok = [RawPrinterHelper]::SendStringToPrinter($PrinterName, $epl)

if ($ok) {
    Write-Host "Etiqueta enviada correctamente a $PrinterName"
} else {
    Write-Host "❌ Error enviando etiqueta a $PrinterName"
}
