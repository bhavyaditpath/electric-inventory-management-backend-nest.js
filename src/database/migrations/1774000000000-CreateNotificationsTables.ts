import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationsTables1774000000000 implements MigrationInterface {
    name = 'CreateNotificationsTables1774000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DO $$ BEGIN
            CREATE TYPE "public"."notifications_type_enum" AS ENUM('user', 'branch');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;`);

        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "notifications" (
            "id" SERIAL NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            "createdBy" integer,
            "updatedBy" integer,
            "isRemoved" boolean NOT NULL DEFAULT false,
            "title" character varying(255) NOT NULL,
            "message" text NOT NULL,
            "type" "public"."notifications_type_enum" NOT NULL,
            "userId" integer,
            "branchId" integer,
            CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
        )`);

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

        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "user_notifications" (
            "id" SERIAL NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            "createdBy" integer,
            "updatedBy" integer,
            "isRemoved" boolean NOT NULL DEFAULT false,
            "userId" integer NOT NULL,
            "notificationId" integer NOT NULL,
            "read" boolean NOT NULL DEFAULT false,
            CONSTRAINT "PK_user_notifications_id" PRIMARY KEY ("id")
        )`);

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
        await queryRunner.query(`ALTER TABLE "user_notifications" DROP CONSTRAINT IF EXISTS "FK_01a2c65f414d36cfe6f5d950fb2"`);
        await queryRunner.query(`ALTER TABLE "user_notifications" DROP CONSTRAINT IF EXISTS "FK_cb22b968fe41a9f8b219327fde8"`);
        await queryRunner.query(`ALTER TABLE "user_notifications" DROP CONSTRAINT IF EXISTS "UQ_1684fc4d342234900b518bcab1c"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "user_notifications"`);

        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_623e1a9554c2f381a22aff0a04e"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_692a909ee0fa9383e7859f9b406"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."notifications_type_enum"`);
    }
}
