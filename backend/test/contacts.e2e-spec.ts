/**
 * End-to-end tests against a real PostgreSQL database.
 * Point DATABASE_URL (or DB_*) at a disposable database before running:
 *   DATABASE_URL=postgres://phonebook:phonebook@localhost:5432/phonebook_test npm run test:e2e
 * The contacts table is truncated before each test.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

describe('Contacts API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    process.env.SEED_DATA = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  beforeEach(async () => {
    await app.get(DataSource).query('TRUNCATE TABLE contacts');
  });

  afterAll(async () => {
    await app.close();
  });

  const create = (body: object) => http.post('/api/contacts').send(body);

  it('runs the full CRUD lifecycle', async () => {
    const created = await create({ firstName: ' Steve ', lastName: 'Jobs', phoneNumber: '(220) 454 6754' }).expect(201);
    expect(created.body).toMatchObject({ firstName: 'Steve', lastName: 'Jobs', phoneNumber: '220-454-6754' });
    const id = created.body.id;

    await http.get(`/api/contacts/${id}`).expect(200);

    const updated = await http.patch(`/api/contacts/${id}`).send({ phoneNumber: '2205550000' }).expect(200);
    expect(updated.body).toMatchObject({ firstName: 'Steve', phoneNumber: '220-555-0000' });

    await http.delete(`/api/contacts/${id}`).expect(204);
    await http.get(`/api/contacts/${id}`).expect(404);
  });

  it('lists contacts sorted by last name and filters by search term', async () => {
    await create({ firstName: 'Steve', lastName: 'Wozniak', phoneNumber: '343-675-8786' }).expect(201);
    await create({ firstName: 'Bill', lastName: 'Gates', phoneNumber: '343-654-9688' }).expect(201);
    await create({ firstName: 'Fred', lastName: 'Allen', phoneNumber: '210-657-9886' }).expect(201);

    const all = await http.get('/api/contacts').expect(200);
    expect(all.body.total).toBe(3);
    expect(all.body.data.map((c: { lastName: string }) => c.lastName)).toEqual(['Allen', 'Gates', 'Wozniak']);

    const byLastName = await http.get('/api/contacts').query({ search: 'gat' }).expect(200);
    expect(byLastName.body.data.map((c: { lastName: string }) => c.lastName)).toEqual(['Gates']);

    const byFullName = await http.get('/api/contacts').query({ search: 'steve woz' }).expect(200);
    expect(byFullName.body.total).toBe(1);

    const byPhone = await http.get('/api/contacts').query({ search: '343' }).expect(200);
    expect(byPhone.body.total).toBe(2);

    const wildcard = await http.get('/api/contacts').query({ search: '%' }).expect(200);
    expect(wildcard.body.total).toBe(0);
  });

  it('paginates results', async () => {
    for (const lastName of ['A', 'B', 'C']) {
      await create({ firstName: 'X', lastName, phoneNumber: '555-555-5555' }).expect(201);
    }
    const page2 = await http.get('/api/contacts').query({ page: 2, limit: 2 }).expect(200);
    expect(page2.body).toMatchObject({ total: 3, page: 2, limit: 2 });
    expect(page2.body.data).toHaveLength(1);
  });

  it('rejects invalid payloads', async () => {
    const res = await create({ firstName: '', lastName: 'Jobs', phoneNumber: 'abc' }).expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining(['firstName is required', expect.stringContaining('phoneNumber')]),
    );
    await create({ firstName: 'A', lastName: 'B', phoneNumber: '123' }).expect(400);
    await create({ firstName: 'A', lastName: 'B', phoneNumber: '555-555-5555', admin: true }).expect(400);
  });

  it('returns 400 for malformed ids and 404 for unknown ids', async () => {
    await http.get('/api/contacts/not-a-uuid').expect(400);
    await http.delete('/api/contacts/00000000-0000-4000-8000-000000000000').expect(404);
  });

  it('reports health', async () => {
    await http.get('/api/health').expect(200, { status: 'ok', database: 'up' });
  });
});
