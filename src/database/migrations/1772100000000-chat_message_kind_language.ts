import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatMessageKindLanguage1772100000000 implements MigrationInterface {
    name = 'ChatMessageKindLanguage1772100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "kind" character varying NOT NULL DEFAULT 'text'`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "language" character varying NOT NULL DEFAULT 'plaintext'`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "forwardedOriginalKind" character varying`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "forwardedOriginalLanguage" character varying`);
        await queryRunner.query(`UPDATE "chat_messages" SET "kind" = 'text' WHERE "kind" IS NULL`);
        await queryRunner.query(`UPDATE "chat_messages" SET "language" = 'plaintext' WHERE "language" IS NULL`);
        await queryRunner.query(`
            UPDATE "chat_messages" AS "m"
            SET
              "forwardedOriginalKind" = COALESCE("m"."forwardedOriginalKind", "src"."kind"),
              "forwardedOriginalLanguage" = COALESCE("m"."forwardedOriginalLanguage", "src"."language")
            FROM "chat_messages" AS "src"
            WHERE "m"."forwardedFromMessageId" = "src"."id"
              AND "m"."isForwarded" = true
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "forwardedOriginalLanguage"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "forwardedOriginalKind"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "language"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "kind"`);
    }
}
