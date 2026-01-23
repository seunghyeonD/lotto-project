import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * 로또 당첨번호 엔티티
 */
@Entity('lotto_draws')
export class LottoDrawEntity {
  @PrimaryColumn()
  round: number;

  @Column({ type: 'date' })
  drawDate: string;

  @Column('int', { array: true })
  numbers: number[];

  @Column()
  bonusNumber: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
