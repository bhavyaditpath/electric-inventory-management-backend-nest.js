import { MigrationInterface, QueryRunner } from "typeorm";

export class CallLogSessionId1772000000000 implements MigrationInterface {
    name = 'CallLogSessionId1772000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "call_logs" ADD "sessionId" character varying(64)`);
        await queryRunner.query(`CREATE INDEX "IDX_call_logs_sessionId" ON "call_logs" ("sessionId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_call_logs_sessionId"`);
        await queryRunner.query(`ALTER TABLE "call_logs" DROP COLUMN "sessionId"`);
    }
}
