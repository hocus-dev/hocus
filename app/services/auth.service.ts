import type { ApiError, User } from "@supabase/gotrue-js";
import { GoTrueApi } from "@supabase/gotrue-js";
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import type { Config } from "~/config";
import { CONFIG_INJECT_TOKEN } from "~/config";

export class AuthService {
  static INJECT_TOKEN = "AuthService" as const;
  static inject = [CONFIG_INJECT_TOKEN];
  private readonly gotrueApi: GoTrueApi;

  constructor(config: Config) {
    this.gotrueApi = new GoTrueApi({
      url: config.gotrueUrl,
      cookieOptions: { lifetime: config.gotrueCookieDuration, domain: config.gotrueCookieDomain },
    });
  }

  // If the request contains a valid access token, return the user object.
  // If the access token is invalid, try to access the refresh token,
  // update the access token, and save it in the response cookies.
  // If the refresh token is invalid or the GoTrue Api returns an error, return null.
  async authorize(
    req: Request,
    res: Response,
  ): Promise<{ user: User; error: undefined } | { user: null; error: ApiError }> {
    const result = await this.gotrueApi.getUserByCookie(req, res);
    if (result.user != null) {
      return { user: result.user, error: void 0 };
    }
    if (result.error?.message === "No cookie found!") {
      return {
        user: null,
        error: { status: StatusCodes.UNAUTHORIZED, message: result.error.message },
      };
    }
    if (result.error?.status === void 0 || result.error?.message === void 0) {
      // TODO: add logging of the error here
      return {
        user: null,
        error: { status: StatusCodes.INTERNAL_SERVER_ERROR, message: "Internal server error" },
      };
    }
    return { user: null, error: result.error };
  }
}
