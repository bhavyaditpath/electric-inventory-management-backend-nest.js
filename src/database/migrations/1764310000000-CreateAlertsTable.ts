import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAlertsTable1764310000000 implements MigrationInterface {
    name = 'CreateAlertsTable1764310000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "alerts" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" integer, "updatedBy" integer, "isRemoved" boolean NOT NULL DEFAULT false, "itemName" character varying(255) NOT NULL, "currentStock" numeric(10,2) NOT NULL, "minStock" integer NOT NULL, "shortage" numeric(10,2) NOT NULL, "priority" character varying(20) NOT NULL DEFAULT 'low', "alertType" character varying(20) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'active', "resolvedDate" TIMESTAMP, "notes" text, "branchId" integer NOT NULL, CONSTRAINT "PK_4c88e956195bba85977da21b8f4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD CONSTRAINT "FK_4c88e956195bba85977da21b8f4_branch" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_4c88e956195bba85977da21b8f4_branch"`);
        await queryRunner.query(`DROP TABLE "alerts"`);
    }
}