import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUserTable1764153696896 implements MigrationInterface {
    name = 'UpdateUserTable1764153696896'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "createdBy" integer`);
        await queryRunner.query(`ALTER TABLE "users" ADD "updatedBy" integer`);
        await queryRunner.query(`ALTER TABLE "users" ADD "isRemoved" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isRemoved"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updatedBy"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "createdBy"`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "status" "public"."users_status_enum" NOT NULL DEFAULT 'ACTIVE'`);
    }

}
