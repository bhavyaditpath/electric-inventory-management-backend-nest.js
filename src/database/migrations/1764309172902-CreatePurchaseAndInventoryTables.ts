import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePurchaseAndInventoryTables1764309172902 implements MigrationInterface {
    name = 'CreatePurchaseAndInventoryTables1764309172902'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "purchases" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" integer, "updatedBy" integer, "isRemoved" boolean NOT NULL DEFAULT false, "productName" character varying(255) NOT NULL, "quantity" numeric(10,2) NOT NULL, "unit" character varying(50) NOT NULL, "pricePerUnit" numeric(10,2) NOT NULL, "totalPrice" numeric(10,2) NOT NULL, "lowStockThreshold" integer NOT NULL, "brand" character varying(255) NOT NULL, "userId" integer NOT NULL, "branchId" integer, CONSTRAINT "PK_1d55032f37a34c6eceacbbca6b8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "inventories" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" integer, "updatedBy" integer, "isRemoved" boolean NOT NULL DEFAULT false, "productName" character varying(255) NOT NULL, "currentQuantity" numeric(10,2) NOT NULL DEFAULT '0', "unit" character varying(50) NOT NULL, "lowStockThreshold" integer NOT NULL, "brand" character varying(255) NOT NULL, "branchId" integer, CONSTRAINT "UQ_923702336f67a8c5c1e0297b0f3" UNIQUE ("productName", "branchId"), CONSTRAINT "PK_7b1946392ffdcb50cfc6ac78c0e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_246426dfd001466a1d5e47322f4" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "purchases" ADD CONSTRAINT "FK_341f0dbe584866284359f30f3da" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "purchases" ADD CONSTRAINT "FK_20351e8d2c1af1c7c203a6a32b4" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventories" ADD CONSTRAINT "FK_2014685d316d58cb0051a2a3374" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "inventories" DROP CONSTRAINT "FK_2014685d316d58cb0051a2a3374"`);
        await queryRunner.query(`ALTER TABLE "purchases" DROP CONSTRAINT "FK_20351e8d2c1af1c7c203a6a32b4"`);
        await queryRunner.query(`ALTER TABLE "purchases" DROP CONSTRAINT "FK_341f0dbe584866284359f30f3da"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_246426dfd001466a1d5e47322f4"`);
        await queryRunner.query(`DROP TABLE "inventories"`);
        await queryRunner.query(`DROP TABLE "purchases"`);
    }

}
