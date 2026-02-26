const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BusinessConfig = require('../models/BusinessConfig');
const { searchProducts } = require('../services/aiTools');
const { buildSystemPrompt } = require('../services/aiService');

let mongoServer;

beforeAll(async () => {
  await mongoose.disconnect(); // Ensure previous connections are closed
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Product Variations', () => {
  let userId;
  let businessId;

  beforeEach(async () => {
    userId = new mongoose.Types.ObjectId();
    const config = await BusinessConfig.create({
      userId,
      businessName: 'Test Business',
      products: [
        {
          name: 'Car Wash',
          price: 50,
          description: 'Standard wash',
          tags: ['wash'],
          variations: [
            { name: 'Hatch', price: 50, durationMinutes: 45 },
            { name: 'Sedan', price: 60, durationMinutes: 60 },
            { name: 'SUV', price: 80, durationMinutes: 90 }
          ]
        },
        {
          name: 'Haircut',
          price: 40,
          description: 'Simple haircut',
          tags: ['hair'],
          variations: [] // No variations
        }
      ]
    });
    businessId = config._id;
  });

  afterEach(async () => {
    await BusinessConfig.deleteMany({});
  });

  test('should store product variations in BusinessConfig', async () => {
    const config = await BusinessConfig.findOne({ userId });
    expect(config.products).toHaveLength(2);

    const carWash = config.products.find(p => p.name === 'Car Wash');
    expect(carWash.variations).toHaveLength(3);
    expect(carWash.variations[0].name).toBe('Hatch');
    expect(carWash.variations[0].price).toBe(50);
    expect(carWash.variations[2].name).toBe('SUV');
    expect(carWash.variations[2].price).toBe(80);

    const haircut = config.products.find(p => p.name === 'Haircut');
    expect(haircut.variations).toHaveLength(0);
  });

  test('searchProducts should return variations', async () => {
    const results = await searchProducts(userId, ['wash']);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Car Wash');
    expect(results[0].variations).toHaveLength(3);
    expect(results[0].variations[0].name).toBe('Hatch');
  });

  test('buildSystemPrompt should include variations in the catalog text', async () => {
    const prompt = await buildSystemPrompt(businessId);

    // Check if variations are mentioned for Car Wash
    expect(prompt).toContain('Item: Car Wash');
    expect(prompt).toContain('Opcoes: Hatch (R$50), Sedan (R$60), SUV (R$80)');

    // Check if Haircut is mentioned without options
    expect(prompt).toContain('Item: Haircut');

    // Check for the Catalog Rule
    expect(prompt).toContain('CATALOG RULE: If the client requests a product/service that has variations');
  });
});
