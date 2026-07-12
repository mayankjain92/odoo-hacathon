export type AuthUserView = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  departmentId: string | null;
  createdAt: Date;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: string;
};

export type AuthSessionResponse = {
  user: AuthUserView;
  tokens: AuthTokens;
};

export type JwtAccessPayload = {
  sub: string;
  email: string;
  role: string;
  typ: "access";
};

export type JwtRefreshPayload = {
  sub: string;
  typ: "refresh";
};
