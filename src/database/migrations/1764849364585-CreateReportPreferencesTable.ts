import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateReportPreferencesTable1764849364585 implements MigrationInterface {
    name = 'CreateReportPreferencesTable1764849364585'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."report_preferences_reporttype_enum" AS ENUM('daily', 'weekly', 'monthly', 'half_yearly', 'yearly')`);
        await queryRunner.query(`CREATE TYPE "public"."report_preferences_deliverymethod_enum" AS ENUM('email', 'local_file')`);
        await queryRunner.query(`CREATE TABLE "report_preferences" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" integer, "updatedBy" integer, "isRemoved" boolean NOT NULL DEFAULT false, "userId" integer NOT NULL, "reportType" "public"."report_preferences_reporttype_enum" NOT NULL, "deliveryMethod" "public"."report_preferences_deliverymethod_enum" NOT NULL DEFAULT 'local_file', "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_8bd9422c2c9e0ca8ab0df102c5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "report_preferences" ADD CONSTRAINT "FK_057fd904cc62440f8eadb9ad34f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "report_preferences" DROP CONSTRAINT "FK_057fd904cc62440f8eadb9ad34f"`);
        await queryRunner.query(`DROP TABLE "report_preferences"`);
        await queryRunner.query(`DROP TYPE "public"."report_preferences_deliverymethod_enum"`);
        await queryRunner.query(`DROP TYPE "public"."report_preferences_reporttype_enum"`);
    }

}
