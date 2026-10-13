import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Contact } from './contact.entity';
import { ContactsService } from './contacts.service';

describe('ContactsService', () => {
  let service: ContactsService;
  const repo = {
    create: jest.fn((dto) => dto),
    save: jest.fn(async (entity) => ({ id: 'generated-id', ...entity })),
    findOneBy: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ContactsService, { provide: getRepositoryToken(Contact), useValue: repo }],
    }).compile();
    service = moduleRef.get(ContactsService);
  });

  it('normalises the phone number on create', async () => {
    const created = await service.create({ firstName: 'Ada', lastName: 'Lovelace', phoneNumber: '(555) 123 4567' });
    expect(repo.create).toHaveBeenCalledWith({ firstName: 'Ada', lastName: 'Lovelace', phoneNumber: '555-123-4567' });
    expect(created.id).toBe('generated-id');
  });

  it('updates only the supplied fields', async () => {
    repo.findOneBy.mockResolvedValue({ id: '1', firstName: 'Ada', lastName: 'Lovelace', phoneNumber: '555-123-4567' });
    const updated = await service.update('1', { lastName: 'Byron' });
    expect(updated).toMatchObject({ firstName: 'Ada', lastName: 'Byron', phoneNumber: '555-123-4567' });
  });

  it('throws NotFound when updating a missing contact', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.update('missing', { firstName: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when deleting a missing contact', async () => {
    repo.delete.mockResolvedValue({ affected: 0 });
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seeds only when the table is empty', async () => {
    repo.count.mockResolvedValue(3);
    await service.seedIfEmpty();
    expect(repo.save).not.toHaveBeenCalled();

    repo.count.mockResolvedValue(0);
    await service.seedIfEmpty();
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
