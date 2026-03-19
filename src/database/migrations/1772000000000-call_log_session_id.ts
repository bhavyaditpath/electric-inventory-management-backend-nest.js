import { MigrationInterface, QueryRunner } from "typeorm";

export class CallLogSessionId1772000000000 implements MigrationInterface {
    name = 'CallLogSessionId1772000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const callLogsTable = await queryRunner.query(`SELECT to_regclass('public.call_logs') as exists`);
        if (!callLogsTable?.[0]?.exists) {
            return;
        }

        await queryRunner.query(`ALTER TABLE "call_logs" ADD COLUMN IF NOT EXISTS "sessionId" character varying(64)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_call_logs_sessionId" ON "call_logs" ("sessionId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_call_logs_sessionId"`);
        await queryRunner.query(`ALTER TABLE "call_logs" DROP COLUMN IF EXISTS "sessionId"`);
    }
}
