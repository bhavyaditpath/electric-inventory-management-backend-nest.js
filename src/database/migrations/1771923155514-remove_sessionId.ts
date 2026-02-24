import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveSessionId1771923155514 implements MigrationInterface {
    name = 'RemoveSessionId1771923155514'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "call_logs" DROP COLUMN "sessionId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "call_logs" ADD "sessionId" character varying(64)`);
    }

}
