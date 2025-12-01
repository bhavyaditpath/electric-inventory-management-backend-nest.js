import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login-auth.dto';
import { RegisterDto } from './dto/register-auth.dto';
import { HashUtil } from '../utils/hash.util';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { LoginResponse } from './types/auth.types';
import { ApiResponse, ApiResponseUtil } from '../shared/api-response';
import { CLIENT_RENEG_LIMIT } from 'tls';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService
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
}
