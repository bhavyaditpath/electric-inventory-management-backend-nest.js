import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUserTable1764159295931 implements MigrationInterface {
    name = 'UpdateUserTable1764159295931'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "branchId" integer`);
        await queryRunner.query(`UPDATE "users" SET "branchId" = 1 WHERE "branchId" IS NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "branchId" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "branchId"`);
    }

}
