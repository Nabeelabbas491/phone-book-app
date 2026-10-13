import { ApiProperty } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'contacts' })
export class Contact {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Steve' })
  @Column({ name: 'first_name', length: 50 })
  firstName: string;

  @ApiProperty({ example: 'Jobs' })
  @Column({ name: 'last_name', length: 50 })
  lastName: string;

  @ApiProperty({ example: '220-454-6754' })
  @Column({ name: 'phone_number', length: 20 })
  phoneNumber: string;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
