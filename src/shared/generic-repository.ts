import {
    Repository,
    FindOptionsWhere,
    FindManyOptions,
    DeepPartial,
} from 'typeorm';

import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IGenericRepository } from './interfaces/generic-repository.interface';

export class GenericRepository<T extends { isRemoved?: boolean }>
    implements IGenericRepository<T> {
    private excludeDeleted = false;

    constructor(private readonly repo: Repository<T>) { }

    withNoDeletedRecord(): this {
        this.excludeDeleted = true;
        return this;
    }

    private applyDeletedFilter(
        options: FindManyOptions<T> = {},
    ): FindManyOptions<T> {
        if (!this.excludeDeleted) return options;

        return {
            ...options,
            where: {
                ...(options.where as any),
                isRemoved: false,
            },
        };
    }

    async findAll(options?: FindManyOptions<T>): Promise<T[]> {
        return this.repo.find(this.applyDeletedFilter(options));
    }

    async findOne(where: FindOptionsWhere<T>): Promise<T | null> {
        let finalWhere: FindOptionsWhere<T> = { ...where };

        if (this.excludeDeleted) {
            finalWhere = { ...finalWhere, isRemoved: false } as any;
        }

        return this.repo.findOne({ where: finalWhere });
    }

    async create(data: DeepPartial<T>): Promise<T> {
        const entity = this.repo.create(data);
        return this.repo.save(entity);
    }

    async update(
        id: any,
        data: QueryDeepPartialEntity<T>,
    ): Promise<T> {
        await this.repo.update(id, data);
        return (await this.findOne({ id } as any))!;
    }

    async softDelete(id: any): Promise<boolean> {
        await this.repo.update(id, { isRemoved: true } as any);
        return true;
    }

    async delete(id: any): Promise<boolean> {
        await this.repo.delete(id);
        return true;
    }

    async paginate(
        page: number = 1,
        pageSize: number = 10,
        options?: FindManyOptions<T>,
    ) {
        const finalOptions = this.applyDeletedFilter(options);

        const [items, total] = await this.repo.findAndCount({
            ...finalOptions,
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        return {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    async bulkInsert(data: DeepPartial<T>[]): Promise<any> {
        return this.repo.insert(data as any);
    }

    async bulkUpdate(data: DeepPartial<T>[]): Promise<any> {
        return this.repo.save(data);
    }
}
