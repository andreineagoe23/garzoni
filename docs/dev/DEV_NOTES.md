# Dev Notes

## Mobile — Local Backend URL (Wi-Fi IP)

When testing on a physical device against the local Docker backend, the device and Mac must be on the same Wi-Fi. The backend URL is the Mac's LAN IP, which **changes every time you switch networks**.

### Fix when "Cannot reach the server" appears

1. Get current IP:
   ```
   ipconfig getifaddr en0
   ```
2. Update both files with the new IP:
   - `mobile/.env.development`
   - `mobile/.env.development.local`
   ```
   EXPO_PUBLIC_BACKEND_URL=http://<new-ip>:8000/api
   ```
3. Restart Expo:
   ```
   npx expo start --clear
   ```

### Notes

- `.env.development.local` takes priority over `.env.development` — updating either one is enough, but keep both in sync to avoid confusion.
- This only affects physical device testing. The simulator uses the same IP but is less sensitive to network changes.
- Production URL lives in `mobile/.env` and points to Railway — do not change that.
