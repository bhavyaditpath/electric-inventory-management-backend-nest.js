import { MigrationInterface, QueryRunner } from "typeorm";

export class CallLogsUpdated1770713426334 implements MigrationInterface {
    name = 'CallLogsUpdated1770713426334'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."call_logs_calltype_enum" AS ENUM('audio', 'video')`);
        await queryRunner.query(`ALTER TABLE "call_logs" ADD "callType" "public"."call_logs_calltype_enum" NOT NULL DEFAULT 'audio'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "call_logs" DROP COLUMN "callType"`);
        await queryRunner.query(`DROP TYPE "public"."call_logs_calltype_enum"`);
    }

}
