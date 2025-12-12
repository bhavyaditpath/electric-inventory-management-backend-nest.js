import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveUniquePurchaseTable1765520437221 implements MigrationInterface {
    name = 'RemoveUniquePurchaseTable1765520437221'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purchases" DROP CONSTRAINT "UQ_5c29bc200f8132aba928832df23"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purchases" ADD CONSTRAINT "UQ_5c29bc200f8132aba928832df23" UNIQUE ("productName", "brand")`);
    }

}
