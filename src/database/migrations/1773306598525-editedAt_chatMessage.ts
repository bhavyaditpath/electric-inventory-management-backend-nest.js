import { MigrationInterface, QueryRunner } from "typeorm";

export class EditedAtChatMessage1773306598525 implements MigrationInterface {
    name = 'EditedAtChatMessage1773306598525'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "editedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "editedAt"`);
    }

}
