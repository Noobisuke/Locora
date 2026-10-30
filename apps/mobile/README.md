# Locora mobile (Expo) — SOURCE OVERLAY, untested

I could not check which Expo SDK is current (no internet in my build sandbox), and Expo Go only opens the newest SDK.
So this folder has only the app source. Create a fresh project with the current versions, then copy this source in:

```powershell
cd apps
npx create-expo-app@latest locora-mobile          # default template already includes expo-router
cd locora-mobile
npx expo install expo-secure-store
# delete the template's app\ folder, then copy from ..\mobile :  app\  lib\  components\  .env.example
copy ..\mobile\.env.example .env                  # edit: EXPO_PUBLIC_API_URL=http://YOUR-PC-IP:4000/api
npx expo start
```
Open the QR code with **Expo Go** (Android). If the `@/` import alias fails, add `"paths": {"@/*": ["./*"]}` under `compilerOptions` in tsconfig.json (the template normally has it).

Phone cannot use `localhost`. Find your PC's IPv4 with `ipconfig`, put it in `.env`, keep phone and PC on the same Wi-Fi,
and allow Node through Windows Firewall (private network) or the phone will time out. Emulator: use `http://10.0.2.2:4000/api`.

Screens: login, register, home (search, categories, grid), product details (gallery, qty, cart, wishlist), cart, checkout (address + COD), orders list/detail/cancel, profile.
NOT in mobile yet: seller/admin/delivery screens, wishlist and address-management screens, online (Razorpay) payment
(it needs `react-native-razorpay`, which does not run in Expo Go; it requires a development build), profile photo upload.
