import { useEffect } from "react";
import { TELEMETRY_DISABLED_COOKIE } from "~/telemetry/constants";

// readCookie from https://stackoverflow.com/a/11767598
const script = `
function readCookie(cookiename) {
  // Get name followed by anything except a semicolon
  var cookiestring=RegExp(cookiename+"=[^;]+").exec(document.cookie);
  // Return everything after the equal sign, or an empty string if the cookie name not found
  return decodeURIComponent(!!cookiestring ? cookiestring.toString().replace(/^[^=]+./,"") : "");
}

!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
if (readCookie("${TELEMETRY_DISABLED_COOKIE}") !== "1") { posthog.init('phc_RlJoTOGCBVKphsU0uucflyOm0cj0sakMdYCRcJ0qj9Q',{api_host:'https://phog.hocus.dev'}) }
`;

export const TelemetryScript = (): JSX.Element => {
  useEffect(() => {
    const inlineScript = document.createElement("script");
    inlineScript.innerHTML = script;
    document.body.append(inlineScript);
    return () => {
      inlineScript.remove();
    };
  }, []);

  return <></>;
};
