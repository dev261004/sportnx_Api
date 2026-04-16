import moment from "moment";
import jwt from "jsonwebtoken";
import config from "../config/config";
import { DecodedTokenPayload, jwtPayload } from "../utils/types";

const generateToken = (
  userId: string,
  role: string | null | undefined,
  secret = config.jwt.secret,
  expires?: { unix: () => number }
) => {
  const payload: jwtPayload = {
    sub: { userId, role },
    iat: moment().unix(),
  };
  if (expires) {
    payload.exp = expires.unix();
  }
  return jwt.sign(payload, secret);
};

const generateAuthTokens = async (
  userId: string,
  role: string | null | undefined
) => {
  const accessTokenExpires = moment().add(
    config.jwt.accessExpirationDays,
    "days"
  );
  const accessToken = generateToken(
    userId,
    role,
    config.jwt.secret,
    accessTokenExpires
  );

  const refreshTokenExpires = moment().add(
    config.jwt.refreshExpirationDays,
    "days"
  );
  const refreshToken = generateToken(
    userId,
    role,
    config.jwt.secret,
    refreshTokenExpires
  );
  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate(),
    },
    refresh: {
      token: refreshToken,
      expires: refreshTokenExpires.toDate(),
    },
    role,
  };
};

const verifyRefreshToken = (
  token: string
): { decoded: DecodedTokenPayload | null; error: unknown } => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as DecodedTokenPayload;
    return { decoded, error: null };
  } catch (error) {
    return { decoded: null, error };
  }
};

export default {
  generateAuthTokens,
  verifyRefreshToken,
};
