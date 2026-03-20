import { MigrationInterface, QueryRunner } from "typeorm";

export class UserNotificationTable1765788805687 implements MigrationInterface {
    name = 'UserNotificationTable1765788805687'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const userNotificationsTable = await queryRunner.query(`SELECT to_regclass('public.user_notifications') as exists`);
        if (!userNotificationsTable?.[0]?.exists) {
            return;
        }

        await queryRunner.query(`ALTER TABLE "user_notifications" DROP CONSTRAINT IF EXISTS "FK_4d6c91e1b5c2f3a4b5c6d7e8f9a"`);
        await queryRunner.query(`ALTER TABLE "user_notifications" DROP CONSTRAINT IF EXISTS "FK_5e7f8a9b0c1d2e3f4a5b6c7d8e"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_user_notification_unique"`);
        await queryRunner.query(`DO $$ BEGIN
            ALTER TABLE "user_notifications" ADD CONSTRAINT "UQ_1684fc4d342234900b518bcab1c" UNIQUE ("userId", "notificationId");
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;`);
        await queryRunner.query(`DO $$ BEGIN
            ALTER TABLE "user_notifications" ADD CONSTRAINT "FK_cb22b968fe41a9f8b219327fde8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;`);
        await queryRunner.query(`DO $$ BEGIN
            ALTER TABLE "user_notifications" ADD CONSTRAINT "FK_01a2c65f414d36cfe6f5d950fb2" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const userNotificationsTable = await queryRunner.query(`SELECT to_regclass('public.user_notifications') as exists`);
        if (!userNotificationsTable?.[0]?.exists) {
            return;
        }

        await queryRunner.query(`ALTER TABLE "user_notifications" DROP CONSTRAINT IF EXISTS "FK_01a2c65f414d36cfe6f5d950fb2"`);
        await queryRunner.query(`ALTER TABLE "user_notifications" DROP CONSTRAINT IF EXISTS "FK_cb22b968fe41a9f8b219327fde8"`);
        await queryRunner.query(`ALTER TABLE "user_notifications" DROP CONSTRAINT IF EXISTS "UQ_1684fc4d342234900b518bcab1c"`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_notification_unique" ON "user_notifications" ("notificationId", "userId")`);
        await queryRunner.query(`DO $$ BEGIN
            ALTER TABLE "user_notifications" ADD CONSTRAINT "FK_5e7f8a9b0c1d2e3f4a5b6c7d8e" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;`);
        await queryRunner.query(`DO $$ BEGIN
            ALTER TABLE "user_notifications" ADD CONSTRAINT "FK_4d6c91e1b5c2f3a4b5c6d7e8f9a" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;`);
    }
}
