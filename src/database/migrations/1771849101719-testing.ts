import { MigrationInterface, QueryRunner } from "typeorm";

export class Testing1771849101719 implements MigrationInterface {
    name = 'Testing1771849101719'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_call_logs_sessionId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const callLogsTable = await queryRunner.query(`SELECT to_regclass('public.call_logs') as exists`);
        if (!callLogsTable?.[0]?.exists) {
            return;
        }

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_call_logs_sessionId" ON "call_logs" ("sessionId") `);
    }

}
