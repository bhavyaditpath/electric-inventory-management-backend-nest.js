import { MigrationInterface, QueryRunner } from "typeorm";

export class ReplyToMessageChatentity1772008837884 implements MigrationInterface {
    name = 'ReplyToMessageChatentity1772008837884'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "replyToMessageId" integer`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_7f14f98223ed064c8904067dce1" FOREIGN KEY ("replyToMessageId") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_7f14f98223ed064c8904067dce1"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "replyToMessageId"`);
    }

}
