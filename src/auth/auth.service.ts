import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login-auth.dto';
import { RegisterDto } from './dto/register-auth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { HashUtil } from '../utils/hash.util';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { LoginResponse } from './types/auth.types';
import { ApiResponse, ApiResponseUtil } from '../shared/api-response';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../shared/enums/role.enum';
import type { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private configService: ConfigService
  ) { }

  async register(dto: RegisterDto): Promise<ApiResponse> {
    const exists = await this.userRepo.findOne({
      where: { username: dto.username }
    });

    if (exists) {
      return ApiResponseUtil.error("Username already exists");
    }

    const hashedPassword = await HashUtil.hash(dto.password);

    const newUser = this.userRepo.create({
      username: dto.username,
      password: hashedPassword,
      role: dto.role
    });

    const savedUser = await this.userRepo.save(newUser);
    return ApiResponseUtil.success(savedUser, "User registered successfully");
  }

  async login(dto: LoginDto): Promise<ApiResponse> {
    const user = await this.userRepo.findOne({
      where: { username: dto.username }
    });

    if (!user) return ApiResponseUtil.error("Invalid credentials");

    const passwordMatch = await HashUtil.compare(dto.password, user.password);

    if (!passwordMatch) return ApiResponseUtil.error("Invalid credentials");

    const tokens = this.generateTokens(user);

    return ApiResponseUtil.success(tokens, "Login successful");
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<ApiResponse> {
    const user = await this.userRepo.findOne({
      where: { username: dto.username }
    });

    if (!user) {
      return ApiResponseUtil.error("User not found");
    }

    const payload = {
      sub: user.id,
      username: user.username
    };

    const token = this.jwtService.sign(payload, { expiresIn: '15m' });

    await this.emailService.sendResetPasswordEmail(user.username, token);

    return ApiResponseUtil.success(null, "Reset email sent successfully");
  }

  async resetPassword(dto: ResetPasswordDto): Promise<ApiResponse> {
    try {
      const payload = this.jwtService.verify(dto.token);

      const user = await this.userRepo.findOne({
        where: { id: payload.sub }
      });

      if (!user) {
        return ApiResponseUtil.error("Invalid token");
      }

      const hashedPassword = await HashUtil.hash(dto.newPassword);

      await this.userRepo.update(user.id, { password: hashedPassword });

      return ApiResponseUtil.success(null, "Password reset successfully");
    } catch (error) {
      return ApiResponseUtil.error("Invalid or expired token");
    }
  }

  async googleLogin(req: any, res: Response): Promise<void> {
    if (!req.user) {
      res.redirect(`${this.configService.get<string>('FRONTEND_URL')}/login?error=google_auth_failed`);
      return;
    }

    const { email, firstName, lastName, picture, googleId } = req.user;

    // Find or create user
    // Find user by googleId
    let user = await this.userRepo.findOne({
      where: { googleId }
    });

    if (!user) {
      // Check both email and username (because username may be email)
      const existingUser = await this.userRepo.findOne({
        where: [
          { email },
          { username: email }
        ]
      });

      if (existingUser) {
        // Link Google to existing user
        existingUser.googleId = googleId;
        existingUser.firstName = firstName;
        existingUser.lastName = lastName;
        existingUser.profilePicture = picture;
        existingUser.isEmailVerified = true;

        user = await this.userRepo.save(existingUser);
      } else {
        // Create new Google user
        const defaultBranchId = this.configService.get<number>('DEFAULT_BRANCH_ID') || 1;

        user = this.userRepo.create({
          username: email,
          email,
          googleId,
          firstName,
          lastName,
          profilePicture: picture,
          isEmailVerified: true,
          role: UserRole.BRANCH,
          branchId: defaultBranchId
        });

        user = await this.userRepo.save(user);
      }
    }

    const tokens = this.generateTokens(user);

    // Redirect to frontend with tokens or set in cookies
    const redirectUrl = `${this.configService.get<string>('FRONTEND_URL')}/auth/google/callback?access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`;
    res.redirect(redirectUrl);
  }

  private generateTokens(user: User): LoginResponse {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      branchId: user.branchId
    };

    const accessToken = this.jwtService.sign(payload);

    // For refresh token, use a different secret or longer expiry
    // For now, use same token as refresh (not ideal, but works)
    const refreshToken = this.jwtService.sign({ ...payload, type: 'refresh' });

    return {
      access_token: accessToken,
      refresh_token: refreshToken
    };
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken) as any;
      if (payload.type !== 'refresh') {
        return ApiResponseUtil.error("Invalid refresh token");
      }

      const user = await this.userRepo.findOne({
        where: { id: payload.sub }
      });

      if (!user) {
        return ApiResponseUtil.error("Invalid refresh token");
      }

      const tokens = this.generateTokens(user);
      return ApiResponseUtil.success(tokens, "Token refreshed");
    } catch (error) {
      return ApiResponseUtil.error("Invalid or expired refresh token");
    }
  }
}
