New-Item -ItemType Directory -Force -Path "D:\000_gitProject\2026\pd2-myitem\app\src-tauri\icons" | Out-Null

Add-Type -AssemblyName System.Drawing

$bmp = New-Object System.Drawing.Bitmap 256, 256
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.Clear([System.Drawing.Color]::FromArgb(15, 118, 110))

$font = New-Object System.Drawing.Font("Segoe UI", 88, [System.Drawing.FontStyle]::Bold)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center

$rect = New-Object System.Drawing.RectangleF(0, 0, 256, 256)
$graphics.DrawString("PD2", $font, [System.Drawing.Brushes]::White, $rect, $format)

$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$stream = [System.IO.File]::Open("D:\000_gitProject\2026\pd2-myitem\app\src-tauri\icons\icon.ico", [System.IO.FileMode]::Create)
$icon.Save($stream)

$stream.Close()
$icon.Dispose()
$graphics.Dispose()
$bmp.Dispose()
$font.Dispose()
$format.Dispose()
