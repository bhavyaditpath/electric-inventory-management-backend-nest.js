import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column } from 'typeorm';

export abstract class BaseEntityClass {
  
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column({ type: 'int', nullable: true })
  createdBy: number | null;

  @Column({ type: 'int', nullable: true })
  updatedBy: number | null;

  @Column({ type: 'boolean', default: false })
  isRemoved: boolean;
}