import { MigrationInterface, QueryRunner } from "typeorm";

export class CallHistory1771330430837 implements MigrationInterface {
    name = 'CallHistory1771330430837'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "call_logs" ADD "recordingSize" integer`);
        await queryRunner.query(`ALTER TABLE "call_logs" ADD "recordingMimeType" character varying`);
        await queryRunner.query(`ALTER TABLE "call_logs" ADD "hasRecording" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "call_logs" DROP COLUMN "hasRecording"`);
        await queryRunner.query(`ALTER TABLE "call_logs" DROP COLUMN "recordingMimeType"`);
        await queryRunner.query(`ALTER TABLE "call_logs" DROP COLUMN "recordingSize"`);
    }

}
