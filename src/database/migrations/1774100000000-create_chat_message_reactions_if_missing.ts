import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatMessageReactionsIfMissing1774100000000
  implements MigrationInterface
{
  name = 'CreateChatMessageReactionsIfMissing1774100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_message_reactions" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdBy" integer,
        "updatedBy" integer,
        "isRemoved" boolean NOT NULL DEFAULT false,
        "messageId" integer NOT NULL,
        "userId" integer NOT NULL,
        "emoji" character varying(32) NOT NULL,
        CONSTRAINT "PK_chat_message_reactions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_chat_message_reactions_message_user_emoji"
      ON "chat_message_reactions" ("messageId", "userId", "emoji")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "chat_message_reactions"
        ADD CONSTRAINT "FK_chat_message_reactions_message"
        FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        ALTER TABLE "chat_message_reactions"
        ADD CONSTRAINT "FK_chat_message_reactions_user"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chat_message_reactions"
      DROP CONSTRAINT IF EXISTS "FK_chat_message_reactions_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "chat_message_reactions"
      DROP CONSTRAINT IF EXISTS "FK_chat_message_reactions_message"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_chat_message_reactions_message_user_emoji"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "chat_message_reactions"
    `);
  }
}
