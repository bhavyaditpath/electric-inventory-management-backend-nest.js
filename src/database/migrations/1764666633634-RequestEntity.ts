import { MigrationInterface, QueryRunner } from "typeorm";

export class RequestEntity1764666633634 implements MigrationInterface {
    name = 'RequestEntity1764666633634'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."requests_status_enum" AS ENUM('Request', 'Accept', 'Reject', 'InTransit', 'Delivered')`);
        await queryRunner.query(`CREATE TABLE "requests" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" integer, "updatedBy" integer, "isRemoved" boolean NOT NULL DEFAULT false, "requestingUserId" integer NOT NULL, "adminUserId" integer NOT NULL, "purchaseId" integer NOT NULL, "status" "public"."requests_status_enum" NOT NULL DEFAULT 'Request', "quantityRequested" numeric(10,2) NOT NULL, "notes" text, CONSTRAINT "PK_0428f484e96f9e6a55955f29b5f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "requests" ADD CONSTRAINT "FK_ffd5059931dcd3c0823fdf103c6" FOREIGN KEY ("requestingUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requests" ADD CONSTRAINT "FK_fa16c0f89025e4d86f5183c3a07" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "requests" ADD CONSTRAINT "FK_d02fea2404f9910a1b217d99ef8" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD CONSTRAINT "FK_030bc66afc4a9e5431ef8865731" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_030bc66afc4a9e5431ef8865731"`);
        await queryRunner.query(`ALTER TABLE "requests" DROP CONSTRAINT "FK_d02fea2404f9910a1b217d99ef8"`);
        await queryRunner.query(`ALTER TABLE "requests" DROP CONSTRAINT "FK_fa16c0f89025e4d86f5183c3a07"`);
        await queryRunner.query(`ALTER TABLE "requests" DROP CONSTRAINT "FK_ffd5059931dcd3c0823fdf103c6"`);
        await queryRunner.query(`DROP TABLE "requests"`);
        await queryRunner.query(`DROP TYPE "public"."requests_status_enum"`);
    }

}
