import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatMessageDeletions1770635486666 implements MigrationInterface {
    name = 'ChatMessageDeletions1770635486666'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chat_message_deletions" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" integer, "updatedBy" integer, "isRemoved" boolean NOT NULL DEFAULT false, "messageId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_f2497b65957e45779a382e8af0a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_43bf84f4d36f267626c889e26f" ON "chat_message_deletions" ("messageId", "userId") `);
        await queryRunner.query(`ALTER TABLE "chat_message_deletions" ADD CONSTRAINT "FK_d63713b486757b51cd78b0c4b5f" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_message_deletions" ADD CONSTRAINT "FK_fede1839c1bd11c51843e4340b7" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_message_deletions" DROP CONSTRAINT "FK_fede1839c1bd11c51843e4340b7"`);
        await queryRunner.query(`ALTER TABLE "chat_message_deletions" DROP CONSTRAINT "FK_d63713b486757b51cd78b0c4b5f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_43bf84f4d36f267626c889e26f"`);
        await queryRunner.query(`DROP TABLE "chat_message_deletions"`);
    }

}
