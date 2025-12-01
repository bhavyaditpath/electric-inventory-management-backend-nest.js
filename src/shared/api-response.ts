export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export class ApiResponseUtil {
  static success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
    };
  }

  static error(message: string): ApiResponse<null> {
    return {
      success: false,
      message,
      data: null,
    };
  }
}