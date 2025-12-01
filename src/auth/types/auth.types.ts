export interface JwtPayload {
  sub: number;       // user id
  username: string;
  role: string;
}

export interface LoginResponse {
  access_token: string;
}
