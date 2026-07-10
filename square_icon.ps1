Add-Type -AssemblyName System.Drawing

$sourcePath = "public\logo.png"
$destPath = "public\icon.png"

$image = [System.Drawing.Image]::FromFile($sourcePath)

$squareSize = 512
$bmp = New-Object System.Drawing.Bitmap $squareSize, $squareSize
$graph = [System.Drawing.Graphics]::FromImage($bmp)

# High quality settings
$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

# Clear with transparency
$graph.Clear([System.Drawing.Color]::Transparent)

# Calculate centering
$ratio = [Math]::Min($squareSize / $image.Width, $squareSize / $image.Height)
$newWidth = [int]($image.Width * $ratio)
$newHeight = [int]($image.Height * $ratio)

$posX = [int](($squareSize - $newWidth) / 2)
$posY = [int](($squareSize - $newHeight) / 2)

$graph.DrawImage($image, $posX, $posY, $newWidth, $newHeight)

$bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$image.Dispose()
$bmp.Dispose()
$graph.Dispose()

Write-Host "Created squared icon at $destPath"
