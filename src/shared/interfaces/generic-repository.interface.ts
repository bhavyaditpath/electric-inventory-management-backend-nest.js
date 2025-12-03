import {
    FindOptionsWhere,
    FindManyOptions,
    DeepPartial
} from 'typeorm';

import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

export interface IGenericRepository<T extends { isRemoved?: boolean }> {
    withNoDeletedRecord(): this;

    findAll(options?: FindManyOptions<T>): Promise<T[]>;

    findOne(where: FindOptionsWhere<T>): Promise<T | null>;

    create(data: DeepPartial<T>): Promise<T>;

    update(id: any, data: QueryDeepPartialEntity<T>): Promise<T>;

    softDelete(id: any): Promise<boolean>;

    delete(id: any): Promise<boolean>;

    paginate(
        page: number,
        pageSize: number,
        options?: FindManyOptions<T>,
    ): Promise<{
        items: T[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }>;

    bulkInsert(data: DeepPartial<T>[]): Promise<any>;

    bulkUpdate(data: DeepPartial<T>[]): Promise<any>;
}
