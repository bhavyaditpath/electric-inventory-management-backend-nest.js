import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatAttachmentViews1773736116662 implements MigrationInterface {
    name = 'ChatAttachmentViews1773736116662'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_message_pins" DROP CONSTRAINT "FK_chat_message_pins_room"`);
        await queryRunner.query(`ALTER TABLE "chat_message_pins" DROP CONSTRAINT "FK_chat_message_pins_message"`);
        await queryRunner.query(`ALTER TABLE "chat_message_pins" DROP CONSTRAINT "FK_chat_message_pins_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_chat_message_pins_room_user_message"`);
        await queryRunner.query(`CREATE TABLE "chat_attachment_views" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" integer, "updatedBy" integer, "isRemoved" boolean NOT NULL DEFAULT false, "attachmentId" integer NOT NULL, "userId" integer NOT NULL, "viewedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_efed3190f4483db609e18e5c53f" UNIQUE ("attachmentId", "userId"), CONSTRAINT "PK_dbf7d49ae5c650edba9e397dd2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "chat_attachments" ADD "isViewOnce" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2e8c48d7e12a1ec7a2c36da283" ON "chat_message_pins" ("chatRoomId", "userId", "messageId") `);
        await queryRunner.query(`ALTER TABLE "chat_attachment_views" ADD CONSTRAINT "FK_fbe43d3aecaa3eb9394d02eed5b" FOREIGN KEY ("attachmentId") REFERENCES "chat_attachments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_attachment_views" ADD CONSTRAINT "FK_f347a987d8f5d3b4c9b4d0fddc4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_message_pins" ADD CONSTRAINT "FK_e023e579bc85f95a58a12af7e81" FOREIGN KEY ("chatRoomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_message_pins" ADD CONSTRAINT "FK_a9bae655355fcbd4e3fce07db88" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_message_pins" ADD CONSTRAINT "FK_c4b2ebd74813f2352ee74425996" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_message_pins" DROP CONSTRAINT "FK_c4b2ebd74813f2352ee74425996"`);
        await queryRunner.query(`ALTER TABLE "chat_message_pins" DROP CONSTRAINT "FK_a9bae655355fcbd4e3fce07db88"`);
        await queryRunner.query(`ALTER TABLE "chat_message_pins" DROP CONSTRAINT "FK_e023e579bc85f95a58a12af7e81"`);
        await queryRunner.query(`ALTER TABLE "chat_attachment_views" DROP CONSTRAINT "FK_f347a987d8f5d3b4c9b4d0fddc4"`);
        await queryRunner.query(`ALTER TABLE "chat_attachment_views" DROP CONSTRAINT "FK_fbe43d3aecaa3eb9394d02eed5b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2e8c48d7e12a1ec7a2c36da283"`);
        await queryRunner.query(`ALTER TABLE "chat_attachments" DROP COLUMN "isViewOnce"`);
        await queryRunner.query(`DROP TABLE "chat_attachment_views"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_chat_message_pins_room_user_message" ON "chat_message_pins" ("chatRoomId", "messageId", "userId") `);
        await queryRunner.query(`ALTER TABLE "chat_message_pins" ADD CONSTRAINT "FK_chat_message_pins_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_message_pins" ADD CONSTRAINT "FK_chat_message_pins_message" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_message_pins" ADD CONSTRAINT "FK_chat_message_pins_room" FOREIGN KEY ("chatRoomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
