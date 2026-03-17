import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class ChatMessagePins1773400000000 implements MigrationInterface {
  name = 'ChatMessagePins1773400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'chat_message_pins',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'chatRoomId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'messageId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'userId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'isRemoved',
            type: 'boolean',
            default: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'chat_message_pins',
      new TableIndex({
        name: 'IDX_chat_message_pins_room_user_message',
        columnNames: ['chatRoomId', 'userId', 'messageId'],
        isUnique: true,
      }),
    );

    // Add foreign keys with quoted column names
    await queryRunner.query(
      `ALTER TABLE "chat_message_pins" ADD CONSTRAINT "FK_chat_message_pins_room" FOREIGN KEY ("chatRoomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message_pins" ADD CONSTRAINT "FK_chat_message_pins_message" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message_pins" ADD CONSTRAINT "FK_chat_message_pins_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_message_pins"`);
  }
}
