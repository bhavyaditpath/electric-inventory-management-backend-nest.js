import { MigrationInterface, QueryRunner } from "typeorm";

export class Testing1771849101719 implements MigrationInterface {
    name = 'Testing1771849101719'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_call_logs_sessionId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_call_logs_sessionId" ON "call_logs" ("sessionId") `);
    }

}
