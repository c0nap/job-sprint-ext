# Icons Directory

This directory should contain the extension icons in the following sizes:

- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon48.png` - 48x48 pixels (extension management page)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Temporary Workaround

For local testing, you can:
1. Create simple PNG files with these dimensions
2. Use an online icon generator
3. Or comment out the `icons` section in `manifest.json` temporarily

The extension will still work without icons, but Chrome will show a default placeholder icon.
