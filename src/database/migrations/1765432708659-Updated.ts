import { MigrationInterface, QueryRunner } from "typeorm";

export class Updated1765432708659 implements MigrationInterface {
    name = 'Updated1765432708659'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purchases" ADD CONSTRAINT "UQ_5c29bc200f8132aba928832df23" UNIQUE ("productName", "brand")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purchases" DROP CONSTRAINT "UQ_5c29bc200f8132aba928832df23"`);
    }

}
