import { MigrationInterface, QueryRunner } from "typeorm";

export class AddedNotificationTable1765777463101 implements MigrationInterface {
    name = 'AddedNotificationTable1765777463101'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const notificationsTable = await queryRunner.query(`SELECT to_regclass('public.notifications') as exists`);
        if (!notificationsTable?.[0]?.exists) {
            return;
        }

        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_4c88e956195bba85977da21b8f4_user"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_4c88e956195bba85977da21b8f4_branch"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "type"`);
        await queryRunner.query(`DO $$ BEGIN
            CREATE TYPE "public"."notifications_type_enum" AS ENUM('user', 'branch');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "type" "public"."notifications_type_enum" NOT NULL DEFAULT 'user'`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`DO $$ BEGIN
            ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;`);
        await queryRunner.query(`DO $$ BEGIN
            ALTER TABLE "notifications" ADD CONSTRAINT "FK_623e1a9554c2f381a22aff0a04e" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const notificationsTable = await queryRunner.query(`SELECT to_regclass('public.notifications') as exists`);
        if (!notificationsTable?.[0]?.exists) {
            return;
        }

        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_623e1a9554c2f381a22aff0a04e"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_692a909ee0fa9383e7859f9b406"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "type"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."notifications_type_enum"`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "type" character varying(20) NOT NULL DEFAULT 'user'`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`DO $$ BEGIN
            ALTER TABLE "notifications" ADD CONSTRAINT "FK_4c88e956195bba85977da21b8f4_branch" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;`);
        await queryRunner.query(`DO $$ BEGIN
            ALTER TABLE "notifications" ADD CONSTRAINT "FK_4c88e956195bba85977da21b8f4_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;`);
    }
}
