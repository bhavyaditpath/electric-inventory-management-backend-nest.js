import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { HashUtil } from '../utils/hash.util';
import { UserDto } from './dto/user.dto';
import { ApiResponse, ApiResponseUtil } from '../shared/api-response';
import { BranchService } from '../branch/branch.service';
import { GenericRepository } from '../shared/generic-repository';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../shared/enums/notification-type.enum';

@Injectable()
export class UserService {
  private readonly userRepository: GenericRepository<User>;

  constructor(
    @InjectRepository(User)
    repo: Repository<User>,
    private readonly branchService: BranchService,
    private readonly notificationService: NotificationService,
  ) {
    this.userRepository = new GenericRepository(repo);
  }

  async create(userDto: UserDto): Promise<ApiResponse> {
    const { username, password, role, branchName } = userDto;

    // Find branch
    const branch = await this.branchService.findByName(branchName);
    if (!branch) {
      return ApiResponseUtil.error('Branch not found');
    }

    // Check unique username inside SAME branch (only active users)
    const existingUser = await this.userRepository
      .withNoDeletedRecord()
      .findOne({
        username,
        branchId: branch.id
      });

    if (existingUser) {
      return ApiResponseUtil.error('Username already exists in this branch');
    }

    // Hash password
    const hashedPassword = await HashUtil.hash(password!);

    const user = await this.userRepository.create({
      username,
      password: hashedPassword,
      role,
      branchId: branch.id,
      isRemoved: false,
    });

    await this.createUserRegistrationNotification(user, branch.name);

    return ApiResponseUtil.success(user, 'User created successfully');
  }

  async findAll(page?: number, pageSize?: number, search?: string): Promise<ApiResponse> {
    if (page && pageSize) {
      // Return paginated result
      const paginatedResult = await this.userRepository
        .withNoDeletedRecord()
        .paginate(page, pageSize);
      
      // Transform the data to include only branch name instead of full branch object
      const transformedUsers = paginatedResult.items.map(user => ({
        ...user,
        branch: user.branch ? user.branch.name : null,
        role: user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
      }));
      
      const transformedResult = {
        ...paginatedResult,
        items: transformedUsers
      };
      
      return ApiResponseUtil.success(transformedResult, 'Users retrieved successfully');
    } else {
      // Build search options for non-paginated request
      let options: any = {};
      
      if (search) {
        // Simple search by username for now
        options.where = { username: search };
      }
      
      // Return all users (backward compatibility)
      const users = await this.userRepository
        .withNoDeletedRecord()
        .findAll(options);
      
      // Transform the data to include only branch name instead of full branch object
      const transformedUsers = users.map(user => ({
        ...user,
        branch: user.branch ? user.branch.name : null,
        role: user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
      }));
      
      return ApiResponseUtil.success(transformedUsers, 'Users retrieved successfully');
    }
  }

  async findOne(id: number): Promise<ApiResponse> {
    const user = await this.userRepository
      .withNoDeletedRecord()
      .findOne({ id });

    if (!user) {
      return ApiResponseUtil.error('User not found');
    }

    // Transform the data to include only branch name instead of full branch object
    const transformedUser = {
      ...user,
      branch: user.branch ? user.branch.name : null,
      role: user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
    };

    return ApiResponseUtil.success(transformedUser, 'User found');
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ username });
  }

  async update(id: number, userDto: UserDto): Promise<ApiResponse> {
    const user = await this.userRepository
      .withNoDeletedRecord()
      .findOne({ id });

    if (!user) {
      return ApiResponseUtil.error('User not found');
    }

    // Determine branch (existing or updated)
    let branchId = user.branchId;

    if (userDto.branchName) {
      const branch = await this.branchService.findByName(userDto.branchName);
      if (!branch) return ApiResponseUtil.error('Branch not found');
      branchId = branch.id;
    }

    // Check username uniqueness in same branch (exclude removed users)
    if (userDto.username) {
      const existingUser = await this.userRepository
        .withNoDeletedRecord()
        .findOne({
          username: userDto.username,
          branchId: branchId
        });

      if (existingUser && existingUser.id !== id) {
        return ApiResponseUtil.error('Username already exists in this branch');
      }
    }

    // Hash password if changed
    if (userDto.password) {
      userDto.password = await HashUtil.hash(userDto.password);
    }

    // Apply updates
    const updatedUser = await this.userRepository.update(id, {
      ...userDto,
      branchId,
    });

    return ApiResponseUtil.success(updatedUser, 'User updated successfully');
  }

  async remove(id: number): Promise<ApiResponse> {
    const user = await this.userRepository.findOne({ id });
    if (!user) {
      return ApiResponseUtil.error('User not found');
    }

    await this.userRepository.softDelete(id);
    return ApiResponseUtil.success(null, 'User deleted successfully');
  }

  private async createUserRegistrationNotification(user: User, branchName: string): Promise<void> {
    try {
      const title = 'Welcome to Electric Inventory';
      const message = `New user ${user.username} has been registered in branch ${branchName}.`;

      await this.notificationService.create({
        title,
        message,
        type: NotificationType.BRANCH,
        branchId: user.branchId,
      });
    } catch (error) {
      console.error('Failed to create user registration notification:', error);
    }
  }
}
