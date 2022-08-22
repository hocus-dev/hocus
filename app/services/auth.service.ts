import type { ApiError, User, Provider } from "@supabase/gotrue-js";
import { GoTrueApi } from "@supabase/gotrue-js";
import { setCookies } from "@supabase/gotrue-js/dist/main/lib/cookies";
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import type { Logger } from "winston";
import type { Config } from "~/config";

class MyApiError implements ApiError {
  constructor(public readonly status: number, public readonly message: string) {}
}

export class AuthService {
  static inject = ["Config", "Logger"] as const;
  private readonly gotrueApi: GoTrueApi;
  private readonly accessTokenCookie: string;
  private readonly refreshTokenCookie: string;

  constructor(config: Config, private readonly logger: Logger) {
    logger.defaultMeta.context = this.constructor.name;
    this.gotrueApi = new GoTrueApi({
      url: config.gotrueUrl,
      cookieOptions: { lifetime: config.gotrueCookieDuration, domain: config.gotrueCookieDomain },
    });
    this.accessTokenCookie = `${this.gotrueApi["cookieName"]()}-access-token`;
    this.refreshTokenCookie = `${this.gotrueApi["cookieName"]()}-access-token`;
  }

  getUrlForOauthProvider(provider: Provider): string {
    return this.gotrueApi.getUrlForProvider(provider, {});
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
    this.logger.silly(result.error);
    if (result.error?.message === "No cookie found!") {
      return {
        user: null,
        error: new MyApiError(StatusCodes.UNAUTHORIZED, result.error.message),
      };
    }
    if (result.error?.status === void 0 || result.error?.message === void 0) {
      this.logger.error(result.error);
      return {
        user: null,
        error: new MyApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Internal server error"),
      };
    }
    return { user: null, error: result.error };
  }

  async signOut(req: Request, res: Response): Promise<void> {
    const accessToken = req.cookies[this.accessTokenCookie] ?? "";
    // remove the refresh token from the gotrue database
    const { error } = await this.gotrueApi.signOut(accessToken);
    if (error != null) {
      throw error;
    }
    setCookies(
      req,
      res,
      [this.accessTokenCookie, this.refreshTokenCookie].map((name) => ({
        name,
        value: "",
        maxAge: -1,
      })),
    );
  }
}
