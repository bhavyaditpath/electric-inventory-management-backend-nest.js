import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { GenericRepository } from '../shared/generic-repository';

@Injectable()
export class BranchService {
  private readonly branchRepository: GenericRepository<Branch>;

  constructor(
    @InjectRepository(Branch)
    repo: Repository<Branch>,
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

    return this.branchRepository.create(createBranchDto);
  }

  async findAll() {
    return this.branchRepository.withNoDeletedRecord().findAll();
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
}
