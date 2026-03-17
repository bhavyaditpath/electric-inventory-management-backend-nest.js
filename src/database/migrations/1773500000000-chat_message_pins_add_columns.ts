import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatMessagePinsAddColumns1773500000000 implements MigrationInterface {
  name = 'ChatMessagePinsAddColumns1773500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add createdBy column if it doesn't exist
    await queryRunner.query(`
      ALTER TABLE "chat_message_pins" 
      ADD COLUMN IF NOT EXISTS "createdBy" int
    `);
    
    // Add updatedBy column if it doesn't exist
    await queryRunner.query(`
      ALTER TABLE "chat_message_pins" 
      ADD COLUMN IF NOT EXISTS "updatedBy" int
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat_message_pins" DROP COLUMN IF EXISTS "createdBy"`);
    await queryRunner.query(`ALTER TABLE "chat_message_pins" DROP COLUMN IF EXISTS "updatedBy"`);
  }
}
