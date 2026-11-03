# Install from a GitHub Release

This guide installs the production build manually in Google Chrome or a Chromium-based browser. It uses the browser's **Load unpacked** developer workflow; it is not the same as a Chrome Web Store installation.

## Steps

1. Open the [Copy 2 Markdown GitHub Releases](https://github.com/weluvabid/copy-2-markdown/releases) page.
2. Download `copy-2-markdown-vX.Y.Z.zip` from the release you want.
3. Extract the ZIP into a permanent directory. Do not delete or move that directory after installation.
4. Open `chrome://extensions` in Chrome.
5. Enable **Developer mode**.
6. Select **Load unpacked**.
7. Choose the extracted directory containing `manifest.json` directly.
8. Pin **Copy 2 Markdown** from Chrome's Extensions menu if you want it visible in the toolbar.

To update, download and extract the newer release into a new permanent directory, remove the old unpacked extension from `chrome://extensions`, and load the new directory. Your browser-managed extension shortcuts may need to be checked at `chrome://extensions/shortcuts` after updating.

## Verify the download

Each GitHub Release includes `SHA256SUMS.txt`. On macOS or Linux, verify the archive from the directory containing the downloaded files:

```sh
shasum -a 256 -c SHA256SUMS.txt
```

On Windows PowerShell:

```powershell
Get-FileHash .\copy-2-markdown-vX.Y.Z.zip -Algorithm SHA256
```

Compare the displayed hash with the corresponding line in `SHA256SUMS.txt`.

## Important platform limitation

Manual unpacked installation is intended for development, testing, and users comfortable managing extensions themselves. Chrome's policies and operating-system restrictions can limit self-hosted extension installation, particularly for managed devices and ordinary Windows/macOS consumer configurations. The Chrome Web Store is the recommended installation path for general users when the listing is available.
