/* NAJAH — production settings. Fill these in, upload, and bump VERSION in sw.js. Leave supabaseUrl empty to keep demo mode. */
window.NAJAH_CONFIG = {
  price: 2000,                 // DZD per month
  priceUsd: 15,                // must match your PayPal plan price

  // Supabase (Project Settings > API). The anon key is meant to be public; never put the service_role key here.
  supabaseUrl: "",
  supabaseAnonKey: "",

  // PayPal Business (Apps & Credentials > Client ID; Subscriptions > Plan ID). Leave empty to hide PayPal & cards.
  paypalClientId: "",
  paypalPlanId: "",
  paypalEmail: "aminegambull@gmail.com",

  // BaridiMob / CCP transfers
  ccp: { name: "Amine Bouteraa", account: "0044228426", cle: "32", rip: "00799999004422842664" },
  graceHours: 48,

  // Ads (free version only). One announced ad every 15–20 minutes of real use.
  ads: {
    enabled: true, minMinutes: 15, maxMinutes: 20, warnSeconds: 5, closeAfter: 5,
    adsenseClient: "",         // "ca-pub-XXXXXXXXXXXXXXXX" once AdSense approves your site
    adsenseSlot: "",           // display ad unit id
    admobInterstitialId: ""    // only for a Capacitor build with @capacitor-community/admob
  },

  storeBuild: "auto",          // inside the Google Play app only Google Play Billing is shown (store rule)
  playSku: "najah_plus_monthly",
  admins: ["aminegambull@gmail.com"]
};
