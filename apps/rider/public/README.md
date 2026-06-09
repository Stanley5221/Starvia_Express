Place your favicon and web icons here for the rider web build.

Recommended filenames:
- `favicon.png` — main web favicon (PNG)
- `favicon.ico` — legacy browser favicon (ICO)
- `logo192.png` and `logo512.png` — PWA icons

You can copy the files from `assets/` with this command (Windows PowerShell):

```powershell
cp .\assets\favicon.png .\public\favicon.png
cp .\assets\icon.png .\public\logo192.png
cp .\assets\splash-icon.png .\public\logo512.png
```

After placing files here, the Expo web build will use `public/favicon.png` as the site favicon.
