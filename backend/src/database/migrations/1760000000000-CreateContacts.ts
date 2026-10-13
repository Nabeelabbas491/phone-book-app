import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContacts1760000000000 implements MigrationInterface {
  name = 'CreateContacts1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE "contacts" (
        "id"           uuid         NOT NULL DEFAULT gen_random_uuid(),
        "first_name"   varchar(50)  NOT NULL,
        "last_name"    varchar(50)  NOT NULL,
        "phone_number" varchar(20)  NOT NULL,
        "created_at"   timestamptz  NOT NULL DEFAULT now(),
        "updated_at"   timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contacts_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_contacts_last_name_first_name" ON "contacts" (lower("last_name"), lower("first_name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_contacts_last_name_first_name"`);
    await queryRunner.query(`DROP TABLE "contacts"`);
  }
}
