import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { PaginatedContactsDto } from './dto/paginated-contacts.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { normalizePhone, phoneDigits } from './phone.util';

const SAMPLE_CONTACTS: Array<Pick<Contact, 'firstName' | 'lastName' | 'phoneNumber'>> = [
  { firstName: 'Eric', lastName: 'Elliot', phoneNumber: '222-555-6575' },
  { firstName: 'Steve', lastName: 'Jobs', phoneNumber: '220-454-6754' },
  { firstName: 'Fred', lastName: 'Allen', phoneNumber: '210-657-9886' },
  { firstName: 'Steve', lastName: 'Wozniak', phoneNumber: '343-675-8786' },
  { firstName: 'Bill', lastName: 'Gates', phoneNumber: '343-654-9688' },
];

/** Escapes LIKE wildcards so user input is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(@InjectRepository(Contact) private readonly contacts: Repository<Contact>) {}

  async findAll({ search, page, limit }: QueryContactsDto): Promise<PaginatedContactsDto> {
    const qb = this.contacts
      .createQueryBuilder('contact')
      .orderBy('lower(contact.last_name)', 'ASC')
      .addOrderBy('lower(contact.first_name)', 'ASC')
      .addOrderBy('contact.created_at', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      const term = `%${escapeLike(search)}%`;
      const conditions = [
        'contact.last_name ILIKE :term',
        'contact.first_name ILIKE :term',
        "(contact.first_name || ' ' || contact.last_name) ILIKE :term",
      ];
      const digits = phoneDigits(search);
      if (digits.length > 0) {
        conditions.push("regexp_replace(contact.phone_number, '[^0-9]', '', 'g') LIKE :digits");
      }
      qb.where(`(${conditions.join(' OR ')})`, { term, digits: `%${digits}%` });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Contact> {
    const contact = await this.contacts.findOneBy({ id });
    if (!contact) {
      throw new NotFoundException(`Contact ${id} not found`);
    }
    return contact;
  }

  create(dto: CreateContactDto): Promise<Contact> {
    const contact = this.contacts.create({ ...dto, phoneNumber: normalizePhone(dto.phoneNumber) });
    return this.contacts.save(contact);
  }

  async update(id: string, dto: UpdateContactDto): Promise<Contact> {
    const contact = await this.findOne(id);
    if (dto.firstName !== undefined) contact.firstName = dto.firstName;
    if (dto.lastName !== undefined) contact.lastName = dto.lastName;
    if (dto.phoneNumber !== undefined) contact.phoneNumber = normalizePhone(dto.phoneNumber);
    return this.contacts.save(contact);
  }

  async remove(id: string): Promise<void> {
    const result = await this.contacts.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`Contact ${id} not found`);
    }
  }

  /** Inserts sample contacts when the table is empty. */
  async seedIfEmpty(): Promise<void> {
    if ((await this.contacts.count()) > 0) return;
    await this.contacts.save(this.contacts.create(SAMPLE_CONTACTS));
    this.logger.log(`Seeded ${SAMPLE_CONTACTS.length} sample contacts`);
  }
}
