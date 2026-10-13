import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { MAX_PHONE_DIGITS, MIN_PHONE_DIGITS, PHONE_PATTERN, phoneDigits } from '../phone.util';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

function HasPhoneDigitCount(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'hasPhoneDigitCount',
      target: target.constructor,
      propertyName,
      options: {
        message: `phoneNumber must contain between ${MIN_PHONE_DIGITS} and ${MAX_PHONE_DIGITS} digits`,
        ...options,
      },
      validator: {
        validate: (value: unknown) => {
          if (typeof value !== 'string') return false;
          const count = phoneDigits(value).length;
          return count >= MIN_PHONE_DIGITS && count <= MAX_PHONE_DIGITS;
        },
      },
    });
}

export class CreateContactDto {
  @ApiProperty({ example: 'Steve', maxLength: 50 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'firstName is required' })
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Jobs', maxLength: 50 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'lastName is required' })
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ example: '220-454-6754', description: 'Digits, spaces, (), - and a leading + are allowed' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'phoneNumber is required' })
  @MaxLength(20)
  @Matches(PHONE_PATTERN, { message: 'phoneNumber may only contain digits, spaces, ( ) - and a leading +' })
  @HasPhoneDigitCount()
  phoneNumber: string;
}
