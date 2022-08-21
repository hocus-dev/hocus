import { redirect } from "@remix-run/node";
import { GoTrueApi } from "@supabase/gotrue-js";

export const loader = async () => {
  const GOTRUE_URL = "http://localhost:9999";
  const api = new GoTrueApi({ url: GOTRUE_URL });
  const url = api.getUrlForProvider("google", {});
  return redirect(url);
};
