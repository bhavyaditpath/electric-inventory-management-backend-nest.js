export interface JwtPayload {
  sub: number;       // user id
  username: string;
  role: string;
  branchId?: number;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
}
