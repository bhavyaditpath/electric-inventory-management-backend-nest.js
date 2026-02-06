import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatRoomPins1770357800822 implements MigrationInterface {
    name = 'ChatRoomPins1770357800822'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chat_room_pins" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdBy" integer, "updatedBy" integer, "isRemoved" boolean NOT NULL DEFAULT false, "chatRoomId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_44d47b031f6538854e6765490b8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_33105e441a06cf795c4ce7d49b" ON "chat_room_pins" ("chatRoomId", "userId") `);
        await queryRunner.query(`ALTER TABLE "chat_room_pins" ADD CONSTRAINT "FK_b31b1269437b1fe2056960a3793" FOREIGN KEY ("chatRoomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_room_pins" ADD CONSTRAINT "FK_6d1d253a9047246970c62f756bc" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_room_pins" DROP CONSTRAINT "FK_6d1d253a9047246970c62f756bc"`);
        await queryRunner.query(`ALTER TABLE "chat_room_pins" DROP CONSTRAINT "FK_b31b1269437b1fe2056960a3793"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_33105e441a06cf795c4ce7d49b"`);
        await queryRunner.query(`DROP TABLE "chat_room_pins"`);
    }

}
