import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatAttchments1770295255681 implements MigrationInterface {
    name = 'ChatAttchments1770295255681'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chat_attachments" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" integer, "updatedBy" integer, "isRemoved" boolean NOT NULL DEFAULT false, "messageId" integer NOT NULL, "url" character varying(500) NOT NULL, "mimeType" character varying(255) NOT NULL, "fileName" character varying(255) NOT NULL, "size" integer NOT NULL, CONSTRAINT "PK_6752d3c3498926995b12c0a04bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "chat_attachments" ADD CONSTRAINT "FK_c23a2d8adafbdc155a6715b50d5" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_attachments" DROP CONSTRAINT "FK_c23a2d8adafbdc155a6715b50d5"`);
        await queryRunner.query(`DROP TABLE "chat_attachments"`);
    }

}
