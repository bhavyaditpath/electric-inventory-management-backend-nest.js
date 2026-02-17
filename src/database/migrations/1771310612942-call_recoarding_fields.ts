import { MigrationInterface, QueryRunner } from "typeorm";

export class CallRecoardingFields1771310612942 implements MigrationInterface {
    name = 'CallRecoardingFields1771310612942'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "call_logs" ADD "recordingPath" character varying(500)`);
        await queryRunner.query(`ALTER TABLE "call_logs" ADD "recordingProcessing" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "call_logs" ADD "recordingChunks" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "call_logs" DROP COLUMN "recordingChunks"`);
        await queryRunner.query(`ALTER TABLE "call_logs" DROP COLUMN "recordingProcessing"`);
        await queryRunner.query(`ALTER TABLE "call_logs" DROP COLUMN "recordingPath"`);
    }

}
