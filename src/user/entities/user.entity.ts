import { BaseEntityClass } from "../../shared/base.entity";
import { UserRole } from "../../shared/enums/role.enum";
import { Column, Entity, ManyToOne, JoinColumn } from "typeorm";
import { Branch } from "../../branch/entities/branch.entity";

@Entity("users")
export class User extends BaseEntityClass {

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({
    type: "enum",
    enum: UserRole,
  })
  role: UserRole;

  @Column()
  branchId: number;

  @ManyToOne(() => Branch, { eager: true })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;
}
