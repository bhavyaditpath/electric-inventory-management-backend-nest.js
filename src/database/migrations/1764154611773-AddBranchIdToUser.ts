import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBranchIdToUser1764154611773 implements MigrationInterface {
    name = 'AddBranchIdToUser1764154611773'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "branchId" integer`);
        await queryRunner.query(`UPDATE "users" SET "branchId" = 1 WHERE "branchId" IS NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "branchId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'BRANCH'`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "branchId"`);
    }

}
