import landingCss from "../styles-landing.css?url";

/** Small landing-only stylesheet — never load on /admin, /home, /chat, etc. */
export const LANDING_STYLESHEET = { rel: "stylesheet" as const, href: landingCss };
