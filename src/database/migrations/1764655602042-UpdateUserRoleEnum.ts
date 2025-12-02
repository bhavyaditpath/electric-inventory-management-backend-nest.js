import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUserRoleEnum1764655602042 implements MigrationInterface {
    name = 'UpdateUserRoleEnum1764655602042'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_4c88e956195bba85977da21b8f4_branch"`);
        await queryRunner.query(`ALTER TYPE "public"."users_role_enum" RENAME TO "users_role_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('Admin', 'Branch')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum" USING "role"::"text"::"public"."users_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "priority"`);
        await queryRunner.query(`CREATE TYPE "public"."alerts_priority_enum" AS ENUM('low', 'medium', 'high', 'critical')`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "priority" "public"."alerts_priority_enum" NOT NULL DEFAULT 'low'`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "alertType"`);
        await queryRunner.query(`CREATE TYPE "public"."alerts_alerttype_enum" AS ENUM('low_stock', 'out_of_stock', 'expiring_soon')`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "alertType" "public"."alerts_alerttype_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."alerts_status_enum" AS ENUM('active', 'resolved', 'dismissed')`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "status" "public"."alerts_status_enum" NOT NULL DEFAULT 'active'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."alerts_status_enum"`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "status" character varying(20) NOT NULL DEFAULT 'active'`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "alertType"`);
        await queryRunner.query(`DROP TYPE "public"."alerts_alerttype_enum"`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "alertType" character varying(20) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "priority"`);
        await queryRunner.query(`DROP TYPE "public"."alerts_priority_enum"`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "priority" character varying(20) NOT NULL DEFAULT 'low'`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum_old" AS ENUM('ADMIN', 'BRANCH')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum_old" USING "role"::"text"::"public"."users_role_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."users_role_enum_old" RENAME TO "users_role_enum"`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD CONSTRAINT "FK_4c88e956195bba85977da21b8f4_branch" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
