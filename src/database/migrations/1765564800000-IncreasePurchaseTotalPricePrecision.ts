import { MigrationInterface, QueryRunner } from 'typeorm';

export class IncreasePurchaseTotalPricePrecision1765564800000 implements MigrationInterface {
  name = 'IncreasePurchaseTotalPricePrecision1765564800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchases" ALTER COLUMN "totalPrice" TYPE numeric(18,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purchases" ALTER COLUMN "totalPrice" TYPE numeric(10,2)`,
    );
  }
}
