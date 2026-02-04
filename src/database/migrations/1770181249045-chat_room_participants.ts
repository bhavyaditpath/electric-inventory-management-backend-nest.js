import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatRoomParticipants1770181249045 implements MigrationInterface {
    name = 'ChatRoomParticipants1770181249045'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chat_room_participants" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" integer, "updatedBy" integer, "isRemoved" boolean NOT NULL DEFAULT false, "chatRoomId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_2fb4058c329ab4f75ba14443764" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_975478c2fa15ea91a55d8e08e4" ON "chat_room_participants" ("chatRoomId", "userId") `);
        await queryRunner.query(`ALTER TABLE "chat_room_participants" ADD CONSTRAINT "FK_45f001549563ec90b01f8f01008" FOREIGN KEY ("chatRoomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_room_participants" ADD CONSTRAINT "FK_2b9c65aa497b5b69da6ad4dfc91" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_room_participants" DROP CONSTRAINT "FK_2b9c65aa497b5b69da6ad4dfc91"`);
        await queryRunner.query(`ALTER TABLE "chat_room_participants" DROP CONSTRAINT "FK_45f001549563ec90b01f8f01008"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_975478c2fa15ea91a55d8e08e4"`);
        await queryRunner.query(`DROP TABLE "chat_room_participants"`);
    }

}
