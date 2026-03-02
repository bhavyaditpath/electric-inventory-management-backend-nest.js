import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatMessageReceipts1772187809573 implements MigrationInterface {
    name = 'ChatMessageReceipts1772187809573'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."chat_message_receipts_status_enum" AS ENUM('sent', 'delivered', 'read')`);
        await queryRunner.query(`CREATE TABLE "chat_message_receipts" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" integer, "updatedBy" integer, "isRemoved" boolean NOT NULL DEFAULT false, "messageId" integer NOT NULL, "userId" integer NOT NULL, "status" "public"."chat_message_receipts_status_enum" NOT NULL DEFAULT 'sent', "deliveredAt" TIMESTAMP, "readAt" TIMESTAMP, CONSTRAINT "PK_4f58f0c9618fabd607de397c165" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c08ebeda195ade403bcc4ec9a9" ON "chat_message_receipts" ("messageId", "userId") `);
        await queryRunner.query(`ALTER TABLE "chat_message_receipts" ADD CONSTRAINT "FK_68bc02a8aac31a6ce91632d0e18" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_message_receipts" ADD CONSTRAINT "FK_71055d5b8a7f6f794c6f8d44390" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_message_receipts" DROP CONSTRAINT "FK_71055d5b8a7f6f794c6f8d44390"`);
        await queryRunner.query(`ALTER TABLE "chat_message_receipts" DROP CONSTRAINT "FK_68bc02a8aac31a6ce91632d0e18"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c08ebeda195ade403bcc4ec9a9"`);
        await queryRunner.query(`DROP TABLE "chat_message_receipts"`);
        await queryRunner.query(`DROP TYPE "public"."chat_message_receipts_status_enum"`);
    }

}
