NAJAH — LAUNCH GUIDE
====================

WHAT'S IN THIS FOLDER
  index.html, config.js, sw.js, manifest.webmanifest, icons/  -> the app (upload to GitHub Pages)
  privacy.html, terms.html                                     -> required by Google Play, Chargily and AdSense
  ads.txt                                                      -> for AdSense (must sit at your DOMAIN ROOT)
  supabase/                                                    -> backend that confirms payments automatically

The app runs in DEMO MODE until you fill config.js (payments simulated, nothing charged).

---------------------------------------------------------------------
STEP 1 — BACKEND (Supabase, free tier is enough to start)
  1. supabase.com > New project.
  2. SQL Editor > paste supabase/migrations/20261001000000_najah_payments.sql > Run.
  3. Install the CLI (npm i -g supabase), then in this folder:
       supabase login
       supabase link --project-ref YOUR_PROJECT_REF
       cp supabase/.env.example supabase/.env   (fill it in)
       supabase secrets set --env-file supabase/.env
       supabase functions deploy
  4. Authentication > URL configuration > Site URL = your GitHub Pages URL.
  5. Put the project URL + anon key in config.js.

STEP 2 — PAYMENTS
  EDAHABIA / CIB  (fully automatic)
    - Open a Chargily Pay merchant account (pay.chargily.com), get the secret key -> CHARGILY_SECRET_KEY.
    - Test with CHARGILY_MODE=test first, then switch to live.
    - The webhook address is set automatically for every checkout. Plus turns on the moment Chargily confirms.
    - This is the method to push: every CCP holder with a Carte Edahabia can pay instantly.

  BaridiMob / CCP transfer  (instant access + your one-tap confirmation)
    - Algérie Poste has no public API to detect incoming transfers, so no app can confirm them 100% automatically.
    - What happens: the student transfers, types the transaction number and uploads the receipt ->
      Plus opens for 48 h right away -> you get a Telegram message (optional) -> you tap Approve in
      Me > Payment review (admin) -> the month is added. Reused transaction numbers are refused automatically.
    - Telegram ping: create a bot with @BotFather, set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.

  PayPal + Visa / Mastercard / Amex  (fully automatic, auto-renews)
    - IMPORTANT: Algerian PayPal accounts are often limited to SENDING money. Log in to aminegambull@gmail.com and
      check that you can RECEIVE payments and that it is (or upgrades to) a Business account. If you can't receive,
      leave paypalClientId empty in config.js and these two options disappear.
    - developer.paypal.com > Apps & Credentials > create app -> Client ID + Secret.
    - Create a Product and a monthly Plan (price = priceUsd) -> Plan ID.
    - Webhooks: URL = https://YOUR_PROJECT.supabase.co/functions/v1/paypal-webhook, events:
      BILLING.SUBSCRIPTION.ACTIVATED, PAYMENT.SALE.COMPLETED, BILLING.SUBSCRIPTION.CANCELLED,
      BILLING.SUBSCRIPTION.SUSPENDED, BILLING.SUBSCRIPTION.EXPIRED -> copy the Webhook ID.
    - Cards (incl. Amex where PayPal supports it) go through PayPal's card checkout; no PayPal account needed for the buyer.

STEP 3 — ADS (free version only)
  - Web / PWA: apply to Google AdSense with your site. AdSense needs ads.txt at the ROOT of your domain,
    which a github.io/najah project page can't provide -> use a custom domain (e.g. najah-dz.com) or a
    USERNAME.github.io repository. Then fill adsenseClient + adsenseSlot.
  - Until AdSense is approved, the ad slot shows "house ads" (Plus, teachers, focus timer), so the rhythm
    is already in place: one ad every 15–20 min of real use, a 5-second warning first, closable after 5 s,
    never during a focus session, quiz, lesson or payment screen, and never for Plus.
  - Android app with real in-app ads: wrap the site with Capacitor + @capacitor-community/admob and set
    admobInterstitialId; the app uses AdMob automatically when it's available.

STEP 4 — PUBLISH THE WEB APP
  - Upload everything (except the supabase folder) to your GitHub Pages repo.
  - Each time you change index.html or config.js, bump VERSION in sw.js (najah-v2 -> najah-v3).

STEP 5 — GOOGLE PLAY
  - pwabuilder.com > your URL > Package for stores > Android. Package id e.g. com.najah.bac.
  - STORE RULE: inside a Play Store app, digital subscriptions must be sold with Google Play Billing.
    The app detects when it runs from the Play app and shows ONLY "Subscribe with Google Play"
    (CCP, BaridiMob, PayPal and card options stay on the website). Google keeps 15% on subscriptions.
  - Play Console > Monetize > Subscriptions: create product id najah_plus_monthly at 2,000 DZD / month.
  - Link a Google Cloud service account (Play Console > API access), put its JSON in GOOGLE_SERVICE_ACCOUNT_JSON
    and your package name in PLAY_PACKAGE_NAME.
  - Store listing: privacy policy URL = https://YOUR-SITE/privacy.html ; "Contains ads" = Yes ;
    Target audience = 16–17 and 18+ (keeps you out of the children's Families programme) ;
    fill the Data safety form (email, name, app activity, purchase history, photos = receipts).

BEFORE GOING LIVE — TEST CHECKLIST
  [ ] Chargily test payment turns Plus on automatically
  [ ] PayPal sandbox subscription turns Plus on; cancelling keeps it until month end
  [ ] BaridiMob: grace opens, approve adds 30 days, reject closes it, same transaction number refused twice
  [ ] Free user sees the warning then the ad after ~15–20 min; Plus user never does
  [ ] Privacy and terms pages open from Me
  [ ] Read privacy.html and terms.html yourself (refund policy etc. are sensible defaults — adjust to your business)
