import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../src/generated/prisma/client';
import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';

config();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const MENU_DATA = [
  {
    category: 'Entradas',
    floorLevel: 1,
    items: [
      { name: 'Capchi de queso', price: 10.0 },
      { name: 'Tequeños', price: 12.0 },
      { name: 'Huancaina', price: 10.0 },
      { name: 'Ocopa', price: 10.0 },
      { name: 'Leche de Tigre', price: 12.0 },
      { name: 'Sopa Dieta', price: 15.0 },
    ],
  },
  {
    category: 'Platos de Fondo',
    floorLevel: 1,
    items: [
      { name: 'Alitas fritas', price: 20.0 },
      { name: 'Pollo brosther', price: 20.0 },
      { name: 'Chicken finger', price: 20.0 },
      { name: 'Ceviche de tilapia', price: 25.0 },
      { name: 'Crispi', price: 25.0 },
      { name: 'Milanesa de pollo', price: 28.0 },
      { name: 'Pechuga a la parrilla', price: 27.0 },
      { name: 'Chicharron andahuaylino', price: 30.0 },
      { name: 'Chicharron de Cuy', price: 55.0 },
    ],
  },
  {
    category: 'Piqueos & Snacks',
    floorLevel: 1,
    items: [{ name: 'Hamburguesa', price: 18.0 }],
  },
  {
    category: 'Desayunos',
    floorLevel: 1,
    items: [
      { name: 'Pollo Deshilachado', price: 10.0 },
      { name: 'Choripán', price: 10.0 },
      { name: 'Pan con milanesa', price: 13.0 },
      { name: 'Pan con Chicharron', price: 13.0 },
      { name: 'Bowl de frutas', price: 15.0 },
      { name: 'Ensalada de frutas', price: 17.0 },
    ],
  },
  {
    category: 'Combos',
    floorLevel: 1,
    items: [
      {
        name: 'Jugo clásico + panqueques de avena + Ensalada de fruta',
        price: 18.0,
      },
    ],
  },
  {
    category: 'Postres',
    floorLevel: 1,
    items: [
      { name: 'Waffles', price: 20.0 },
      { name: 'Waffle burbuja', price: 13.0 },
      { name: 'Crepes', price: 20.0 },
      { name: 'Brownie', price: 20.0 },
      { name: 'Crema Especial (fruta de temporada)', price: 15.0 },
      { name: 'Panqueques de avena', price: 18.0 },
    ],
  },
  {
    category: 'Helados',
    floorLevel: 3,
    items: [
      { name: 'Copa Clásica', price: 10.0 },
      { name: 'Copa experiencia', price: 15.0 },
      { name: 'Banana Splite', price: 15.0 },
    ],
  },
  {
    category: 'BEBIDAS, JUGOS & REFRESCANTES ',
    floorLevel: 3,
    items: [
      { name: 'Café', price: 4.0 },
      { name: 'Infusiones', price: 4.0 },
      { name: 'Café Expreso', price: 6.0 },
      { name: 'Capuchino', price: 12.0 },
      { name: 'Jugos (frutas de temporada)', price: 10.0 },
      { name: 'Chicha Morada', price: 12.0 },
      { name: 'Maracuyá', price: 12.0 },
      { name: 'Limonada', price: 12.0 },
    ],
  },
  {
    category: 'Bebidas Frías',
    floorLevel: 3,
    items: [
      { name: 'Soda Italiana', price: 10.0 },
      { name: 'Frappe', price: 15.0 },
      { name: 'Bubble tea', price: 18.0 },
      { name: 'Refrescantes 1L', price: 18.0 },
    ],
  },
];

async function main() {
  console.log('🌱 Iniciando Seed de Base de Datos para Ice Mankora...');

  console.log('... Creando Pisos');
  const floor1 = await prisma.floor.upsert({
    where: { level: 1 },
    update: {},
    create: { name: 'Piso 1 - Heladería & Café', level: 1 },
  });

  const floor2 = await prisma.floor.upsert({
    where: { level: 2 },
    update: {},
    create: { name: 'Piso 2 - Restaurante', level: 2 },
  });

  const floor3 = await prisma.floor.upsert({
    where: { level: 3 },
    update: {},
    create: { name: 'Piso 3 - Eventos & Terraza', level: 3 },
  });

  console.log('... Creando Usuarios');
  const passwordHash = await bcrypt.hash('123456', 10);

  await prisma.user.upsert({
    where: { username: 'ADMIN1' },
    update: {},
    create: {
      name: 'Carlos Dueñas',
      dni: '10000001',
      username: 'ADMIN1',
      password: await bcrypt.hash('1000', 10),
      role: UserRole.ADMIN,
      floors: {
        connect: [{ id: floor1.id }, { id: floor2.id }, { id: floor3.id }],
      },
    },
  });

  await prisma.user.upsert({
    where: { username: 'ADMIN2' },
    update: {},
    create: {
      name: 'Sofia Gerente',
      dni: '10000002',
      username: 'ADMIN2',
      password: await bcrypt.hash('1000', 10),
      role: UserRole.ADMIN,
      floors: {
        connect: [{ id: floor1.id }, { id: floor2.id }, { id: floor3.id }],
      },
    },
  });

  await prisma.user.upsert({
    where: { username: 'CAJA1' },
    update: {},
    create: {
      name: 'Luis Cajero',
      dni: '20000001',
      username: 'CAJA1',
      password: await bcrypt.hash('2000', 10),
      role: UserRole.CAJERO,
      floors: {
        connect: [{ id: floor1.id }, { id: floor2.id }, { id: floor3.id }],
      },
    },
  });

  await prisma.user.upsert({
    where: { username: 'MOZO1A' },
    update: {},
    create: {
      name: 'Juan Heladero',
      dni: '30000001',
      username: 'MOZO1A',
      password: await bcrypt.hash('3000', 10),
      role: UserRole.MOZO,
      floors: { connect: [{ id: floor1.id }, { id: floor2.id }] },
    },
  });

  await prisma.user.upsert({
    where: { username: 'MOZO1B' },
    update: {},
    create: {
      name: 'Maria Cafetera',
      dni: '30000002',
      username: 'MOZO1B',
      password: await bcrypt.hash('3000', 10),
      role: UserRole.MOZO,
      floors: { connect: [{ id: floor1.id }, { id: floor2.id }] },
    },
  });

  await prisma.user.upsert({
    where: { username: 'MOZO2A' },
    update: {},
    create: {
      name: 'Pedro Mesero',
      dni: '40000001',
      username: 'MOZO2A',
      password: await bcrypt.hash('4000', 10),
      role: UserRole.MOZO,
      floors: { connect: [{ id: floor1.id }, { id: floor2.id }] },
    },
  });

  await prisma.user.upsert({
    where: { username: 'MOZO2B' },
    update: {},
    create: {
      name: 'Ana Salon',
      dni: '40000002',
      username: 'MOZO2B',
      password: await bcrypt.hash('4000', 10),
      role: UserRole.MOZO,
      floors: { connect: [{ id: floor1.id }, { id: floor2.id }] },
    },
  });

  // --- Mozos Piso 3 (Eventos / Apoyo) ---
  await prisma.user.upsert({
    where: { username: 'MOZO3A' },
    update: {},
    create: {
      name: 'Jorge Terraza',
      dni: '50000001',
      username: 'MOZO3A',
      password: await bcrypt.hash('5000', 10),
      role: UserRole.MOZO,
      floors: { connect: [{ id: floor3.id }, { id: floor2.id }] }, // Piso 3 y apoya en Piso 2
    },
  });

  await prisma.user.upsert({
    where: { username: 'MOZO3B' },
    update: {},
    create: {
      name: 'Lucia Eventos',
      dni: '50000002',
      username: 'MOZO3B',
      password: await bcrypt.hash('5000', 10),
      role: UserRole.MOZO,
      floors: { connect: [{ id: floor3.id }] },
    },
  });

  await prisma.user.upsert({
    where: { username: 'MOZO3C' },
    update: {},
    create: {
      name: 'Lucia ero',
      dni: '50000003',
      username: 'MOZO3C',
      password: await bcrypt.hash('5000', 10),
      role: UserRole.MOZO,
      floors: { connect: [{ id: floor3.id }] },
    },
  });

  // 3. CREAR CATEGORÍAS Y PRODUCTOS (MENU)
  console.log('... Creando Carta y Productos');

  for (const group of MENU_DATA) {
    // Determinar a qué ID de piso corresponde el nivel lógico
    let targetFloorId = floor1.id;
    if (group.floorLevel === 2) targetFloorId = floor2.id;
    if (group.floorLevel === 3) targetFloorId = floor3.id;

    // Crear Categoría
    const slug = group.category
      .toLowerCase()
      .replace(/ /g, '-')
      .replace(/&/g, 'y');

    // Usamos findFirst para ver si existe por slug, si no upsert
    // (Nota: Upsert requiere @unique, slug debería serlo, pero usaremos lógica simple aquí)
    let category = await prisma.category.findFirst({ where: { slug } });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: group.category,
          slug: slug,
          floors: { connect: [{ id: targetFloorId }] }, // Conectamos al piso correspondiente
        },
      });
    }

    // Crear Productos dentro de la categoría
    for (const item of group.items) {
      // Buscamos si existe para no duplicar (usando nombre como llave única lógica aquí)
      const existingProduct = await prisma.product.findFirst({
        where: { name: item.name, categoryId: category.id },
      });

      if (!existingProduct) {
        await prisma.product.create({
          data: {
            name: item.name,
            price: item.price,
            categoryId: category.id,
            stockDaily: 20, // Stock ficticio inicial
            stockWarehouse: 100,
            description: `Delicioso ${item.name} estilo Ice Mankora`,
            isActive: true,
            taxType: 'GRAVADO', // Default SUNAT
            igvRate: 0.18,
          },
        });
      }
    }
  }

  // 4. CREAR MESAS
  console.log('... Creando Mesas');

  // Función helper para crear mesas
  const createTables = async (
    floorId: string,
    startNum: number,
    count: number,
  ) => {
    for (let i = 0; i < count; i++) {
      const num = startNum + i;
      // Upsert basado en la restricción única [floorId, number]
      const existingTable = await prisma.table.findUnique({
        where: {
          floorId_number: {
            floorId: floorId,
            number: num,
          },
        },
      });

      if (!existingTable) {
        await prisma.table.create({
          data: {
            number: num,
            name: `Mesa ${num}`,
            floorId: floorId,
            posX: (i % 5) * 100, // Coordenadas dummy para el mapa
            posY: Math.floor(i / 5) * 100,
          },
        });
      }
    }
  };

  await createTables(floor1.id, 1, 10); // Mesas 1-10 en Piso 1
  await createTables(floor2.id, 1, 10); // Mesas 1-10 en Piso 2 (Numérico se repite, pero piso es diferente)
  await createTables(floor3.id, 1, 8); // Mesas 1-8 en Piso 3

  await prisma.systemConfig.upsert({
    where: { key: 'ADMIN_PIN' },
    update: {},
    create: {
      key: 'ADMIN_PIN',
      value: '9999',
      description: 'PIN maestro para anulaciones y acciones sensibles',
    },
  });

  // Configurar impresoras para cada piso
  await prisma.floor.update({
    where: { level: 1 },
    data: {
      printerIp: '192.168.1.10',
      printerPort: 9100,
    },
  });

  await prisma.floor.update({
    where: { level: 2 },
    data: {
      printerIp: '192.168.1.11',
      printerPort: 9100,
    },
  });

  await prisma.floor.update({
    where: { level: 3 },
    data: {
      printerIp: '192.168.1.12',
      printerPort: 9100,
    },
  });

  console.log('✅ Seeding finalizado con éxito.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
