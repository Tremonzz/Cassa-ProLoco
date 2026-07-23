Add-Type -AssemblyName System.Drawing

$pngPath = "G:\Il mio Drive\PC\LAVORO\Comune di Lorenzago\Programmi\metallic-kepler\public\images\installer_sidebar.png"
$bmpPath = "G:\Il mio Drive\PC\LAVORO\Comune di Lorenzago\Programmi\metallic-kepler\public\images\installer_sidebar.bmp"

$png = [System.Drawing.Image]::FromFile($pngPath)
$bmp = New-Object System.Drawing.Bitmap(164, 314, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($png, 0, 0, 164, 314)
$bmp.Save($bmpPath, [System.Drawing.Imaging.ImageFormat]::Bmp)

$g.Dispose()
$bmp.Dispose()
$png.Dispose()

Write-Host "BMP creato con successo: $bmpPath"
