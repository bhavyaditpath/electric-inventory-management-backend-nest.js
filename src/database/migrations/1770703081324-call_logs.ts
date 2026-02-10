import { MigrationInterface, QueryRunner } from "typeorm";

export class CallLogs1770703081324 implements MigrationInterface {
    name = 'CallLogs1770703081324'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."call_logs_status_enum" AS ENUM('missed', 'answered', 'rejected', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "call_logs" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" integer, "updatedBy" integer, "isRemoved" boolean NOT NULL DEFAULT false, "roomId" integer NOT NULL, "callerId" integer NOT NULL, "receiverId" integer NOT NULL, "status" "public"."call_logs_status_enum" NOT NULL DEFAULT 'missed', "startedAt" TIMESTAMP, "endedAt" TIMESTAMP, "duration" integer, CONSTRAINT "PK_aa08476bcc13bfdf394261761e9" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "call_logs"`);
        await queryRunner.query(`DROP TYPE "public"."call_logs_status_enum"`);
    }

}
