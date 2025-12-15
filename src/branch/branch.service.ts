import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { GenericRepository } from '../shared/generic-repository';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../shared/enums/notification-type.enum';

@Injectable()
export class BranchService {
  private readonly branchRepository: GenericRepository<Branch>;

  constructor(
    @InjectRepository(Branch)
    repo: Repository<Branch>,
    private readonly notificationService: NotificationService,
  ) {
    this.branchRepository = new GenericRepository(repo);
  }

  async create(createBranchDto: CreateBranchDto) {
    // Check if branch name already exists
    const existingBranch = await this.branchRepository
      .withNoDeletedRecord()
      .findOne({ name: createBranchDto.name });
    if (existingBranch) {
      throw new Error('Branch name already exists');
    }

    const branch = await this.branchRepository.create(createBranchDto);
    // Create notification for new branch
    await this.createBranchCreationNotification(branch);

    return branch;
  }

  async findAll(page?: number, pageSize?: number, search?: string, sortBy?: string, sortOrder?: 'ASC' | 'DESC') {
    if (page && pageSize) {
      return this.searchBranchesWithPagination(page, pageSize, search, sortBy, sortOrder);
    }
    
    return this.branchRepository.withNoDeletedRecord().findAll();
  }

  private async searchBranchesWithPagination(
    page: number,
    pageSize: number,
    search?: string,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC'
  ) {
    const queryBuilder = this.branchRepository['repo']
      .createQueryBuilder('branch')
      .where('branch.isRemoved = :isRemoved', { isRemoved: false });

    // Add search conditions if search term is provided
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      queryBuilder.andWhere(
        '(branch.name LIKE :searchTerm)',
        { searchTerm }
      );
    }

    // Add dynamic sorting
    const validSortFields = ['name', 'address', 'phone', 'id', 'createdAt', 'updatedAt'];
    const sortField = sortBy && validSortFields.includes(sortBy) ? sortBy : 'name';
    const sortDirection = sortOrder === 'DESC' ? 'DESC' : 'ASC';
    
    queryBuilder.orderBy(`branch.${sortField}`, sortDirection);

    // Calculate pagination
    const offset = (page - 1) * pageSize;
    queryBuilder.skip(offset).take(pageSize);

    // Execute query
    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: number) {
    return this.branchRepository.withNoDeletedRecord().findOne({ id });
  }

  async findByName(name: string): Promise<Branch | null> {
    return this.branchRepository.withNoDeletedRecord().findOne({ name });
  }

  async update(id: number, updateBranchDto: UpdateBranchDto) {
    // Check if branch name already exists (excluding current branch)
    if (updateBranchDto.name) {
      const existingBranch = await this.branchRepository.findOne({ name: updateBranchDto.name });
      if (existingBranch && existingBranch.id !== id) {
        throw new Error('Branch name already exists');
      }
    }

    return this.branchRepository.update(id, updateBranchDto);
  }

  async remove(id: number) {
    const branch = await this.findOne(id);
    if (branch) {
      await this.branchRepository.softDelete(id);
    }
    return branch;
  }

  private async createBranchCreationNotification(branch: Branch): Promise<void> {
    try {
      const title = 'New Branch Created';
      const message = `A new branch "${branch.name}" has been created at ${branch.address}.`;

      // Since this is a system-wide event, we might want to notify all admin users
      // For now, we'll create a general notification that can be seen by all users
      await this.notificationService.create({
        title,
        message,
        type: NotificationType.BRANCH,
        branchId: branch.id,
      });
    } catch (error) {
      console.error('Failed to create branch creation notification:', error);
    }
  }
}

