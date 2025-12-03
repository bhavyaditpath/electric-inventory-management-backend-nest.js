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

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private emailService: EmailService
  ) {}

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

    const payload = {
      sub: user!.id,
      username: user!.username,
      role: user!.role,
      branchId: user.branchId
    };

    const token = this.jwtService.sign(payload);

    return ApiResponseUtil.success({ access_token: token }, "Login successful");
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
}
