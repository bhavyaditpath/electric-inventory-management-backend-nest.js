import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatMessageReactions1771414579250 implements MigrationInterface {
    name = 'ChatMessageReactions1771414579250'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_message_reactions" DROP CONSTRAINT "FK_3e2f0731c8e084f1f535bbec34a"`);
        await queryRunner.query(`ALTER TABLE "chat_message_reactions" DROP CONSTRAINT "FK_0835276f3f05d2d8f0018c2f76f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9a90f06177dcbb9a8f956ca0f0"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5ba0b3b9cea0e147676fe240fb" ON "chat_message_reactions" ("messageId", "userId", "emoji") `);
        await queryRunner.query(`ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "FK_9ed14288a4da904ad73a4ab4cd7" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "FK_fb41ef3d282a5ccda057f0c856f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_message_reactions" DROP CONSTRAINT "FK_fb41ef3d282a5ccda057f0c856f"`);
        await queryRunner.query(`ALTER TABLE "chat_message_reactions" DROP CONSTRAINT "FK_9ed14288a4da904ad73a4ab4cd7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5ba0b3b9cea0e147676fe240fb"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9a90f06177dcbb9a8f956ca0f0" ON "chat_message_reactions" ("emoji", "messageId", "userId") `);
        await queryRunner.query(`ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "FK_0835276f3f05d2d8f0018c2f76f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_message_reactions" ADD CONSTRAINT "FK_3e2f0731c8e084f1f535bbec34a" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
