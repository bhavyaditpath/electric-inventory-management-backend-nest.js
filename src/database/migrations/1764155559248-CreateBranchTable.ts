import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBranchTable1764155559248 implements MigrationInterface {
    name = 'CreateBranchTable1764155559248'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "branches" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" integer, "updatedBy" integer, "isRemoved" boolean NOT NULL DEFAULT false, "name" character varying NOT NULL, "address" character varying, "phone" character varying, CONSTRAINT "UQ_8387ed27b3d4ca53ec3fc7b029c" UNIQUE ("name"), CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "branchId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "branchId" integer NOT NULL`);
        await queryRunner.query(`DROP TABLE "branches"`);
    }

}
