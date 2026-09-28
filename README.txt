NAJAH - BAC demo app (PWA)

1. Create a new PUBLIC repository on GitHub (e.g. "najah").
2. Upload EVERYTHING in this folder (index.html, manifest.webmanifest, sw.js, and the icons folder) to the repo root.
3. Settings > Pages > Source: "Deploy from a branch", Branch: main, folder: / (root) > Save.
4. After ~1 minute your app is at https://YOUR-USERNAME.github.io/najah/

Install on Android: open the link in Chrome > menu > "Install app" (or "Add to Home screen").
Install on iPhone: open the link in Safari > Share > "Add to Home Screen".

Get an APK / Play Store file: go to https://www.pwabuilder.com, paste your GitHub Pages link,
click "Package for stores" > Android. Download the zip: it contains a test APK you can install
on your phone, plus the .aab file Google Play asks for.

When you change index.html later, also change VERSION in sw.js (najah-v1 -> najah-v2) so phones get the update.
