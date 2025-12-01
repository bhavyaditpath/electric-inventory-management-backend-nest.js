import { BaseEntityClass } from "../../shared/base.entity";
import { Column, Entity } from "typeorm";

@Entity("branches")
export class Branch extends BaseEntityClass {
  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: "varchar", nullable: true })
  phone?: string;
}
