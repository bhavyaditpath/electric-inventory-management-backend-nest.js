import { MigrationInterface, QueryRunner } from "typeorm";

export class ForwardmessagesChatentity1772011899264 implements MigrationInterface {
    name = 'ForwardmessagesChatentity1772011899264'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "isForwarded" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "forwardedFromMessageId" integer`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "forwardedOriginalSenderId" integer`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "forwardedOriginalSenderName" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "forwardedOriginalCreatedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "forwardedOriginalContent" text`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_5e69b54c4d9dae2213a65f8ab18" FOREIGN KEY ("forwardedFromMessageId") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_5e69b54c4d9dae2213a65f8ab18"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "forwardedOriginalContent"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "forwardedOriginalCreatedAt"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "forwardedOriginalSenderName"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "forwardedOriginalSenderId"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "forwardedFromMessageId"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "isForwarded"`);
    }

}
