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
  // ================================
  //           ENTRADAS
  // ================================
  {
    category: 'Entradas',
    floorLevel: 1,
    items: [
      { name: 'Tequeños clásicos', price: 16.0 },
      { name: 'Tequeños Hawaianos', price: 18.0 },
      { name: 'Capchi de queso', price: 10.0 },
      { name: 'Huancaina', price: 10.0 },
      { name: 'Ocopa', price: 10.0 },
      { name: 'Sopa Dieta de pollo', price: 15.0 },
    ],
  },

  // ================================
  //        PLATOS DE FONDO
  // ================================
  {
    category: 'Platos de Fondo',
    floorLevel: 1,
    items: [
      { name: 'Ceviche de tilapia', price: 25.0 },
      { name: 'Milanesa de pollo', price: 20.0 },
      { name: 'Pechuga a la parrilla', price: 27.0 },
      { name: 'Chicharrón Andahuaylino', price: 30.0 },
      { name: 'Chicharrón de Cuy', price: 55.0 },
    ],
  },

  // ================================
  //        PIQUEOS & SNACKS
  // ================================
  {
    category: 'Piqueos & Snacks',
    floorLevel: 1,
    items: [
      { name: 'Chicken Pops', price: 20.0 },
      { name: 'Chicken finger', price: 20.0 },
      { name: 'Hamburguesa clásica', price: 18.0 },
      { name: 'Hamburguesa royal', price: 20.0 },
      { name: 'Hamburguesa especial de casa', price: 22.0 },
      { name: 'Alitas en salsa acevichada', price: 20.0 },
      { name: 'Alitas BBQ', price: 22.0 },
      { name: 'Alitas en salsa Maracumango', price: 25.0 },
      { name: 'Alitas en salsa aguaymanto picante', price: 25.0 },
      { name: 'Alitas mixtas', price: 27.0 },
      { name: 'Hamburguesa royal', price: 20.0 },
      { name: 'SalchiKora', price: 18.0 },
      { name: 'ChoriMan', price: 15.0 },
      { name: 'Tonkatsu', price: 28.0 },
    ],
  },

  // ================================
  //       PARA EMPEZAR EL DÍA
  // ================================
  {
    category: 'Para empezar el día',
    floorLevel: 1,
    items: [
      { name: 'Bowl de frutas', price: 15.0 },
      { name: 'Ensalada de frutas', price: 17.0 },
    ],
  },

  // ================================
  //           SANDWICHES
  // ================================
  {
    category: 'Sandwiches',
    floorLevel: 1,
    items: [
      { name: 'Pollo deshilachado', price: 10.0 },
      { name: 'Choripán', price: 10.0 },
      { name: 'Pan con milanesa', price: 13.0 },
      { name: 'Pan con chicharrón', price: 15.0 },
    ],
  },

  // ================================
  //          HELADOS GOURMET
  // ================================
  {
    category: 'Helados Gourmet',
    floorLevel: 1,
    items: [
      { name: 'Copa Clásica', price: 10.0 },
      { name: 'Banana Split', price: 15.0 },
    ],
  },

  // ================================
  //        POSTRES ICE MANKORA
  // ================================
  {
    category: 'Postres Ice Mankora',
    floorLevel: 1,
    items: [
      { name: 'Waffles', price: 20.0 },
      { name: 'Crepes', price: 20.0 },
      { name: 'Brownies', price: 15.0 },
      { name: 'Fresas con crema', price: 15.0 },
      { name: 'Panques', price: 18.0 },
    ],
  },

  // ================================
  //      POSTRES TRADICIONALES
  // ================================
  {
    category: 'Postres Tradicionales',
    floorLevel: 1,
    items: [
      { name: 'Gelatinas', price: 5.0 },
      { name: 'Flan', price: 5.0 },
      { name: 'Mause maracuyá', price: 7.0 },
      { name: 'Cheesecake', price: 12.0 },
      { name: 'Tartaleta', price: 10.0 },
      { name: 'Cuchareables', price: 8.0 },
    ],
  },

  // ================================
  //             PASTELES
  // ================================
  {
    category: 'Pasteles',
    floorLevel: 1,
    items: [
      { name: 'Enrollado de queso', price: 1.5 },
      { name: 'Enrollado de sauco', price: 1.5 },
      { name: 'Pionono', price: 1.5 },
      { name: 'Cachitos', price: 1.5 },
      { name: 'Leche asada', price: 2.0 },
      { name: 'Pie de manzana', price: 2.5 },
      { name: 'Empanada de carne', price: 5.0 },
      { name: 'Empanada de pollo', price: 5.0 },
      { name: 'Torta helada', price: 5.0 },
    ],
  },

  // ================================
  //             COMBOS
  // ================================
  {
    category: 'Combos',
    floorLevel: 1,
    items: [
      {
        name: 'Jugo clásico + panques de avena + ensalada de frutas',
        price: 18.0,
      },
      {
        name: 'Jugo clásico + empanada + café pasado',
        price: 15.0,
      },
    ],
  },

  // ================================
  //         BEBIDAS CALIENTES
  // ================================
  {
    category: 'Bebidas Calientes',
    floorLevel: 3,
    items: [
      { name: 'Café', price: 4.0 },
      { name: 'Chocolate', price: 5.0 },
      { name: 'Café Expreso', price: 6.0 },
      { name: 'Capuchino', price: 12.0 },
    ],
  },

  // ================================
  //            INFUSIONES
  // ================================
  {
    category: 'Infusiones',
    floorLevel: 3,
    items: [{ name: 'Infusiones (naturales y aromáticas)', price: 4.0 }],
  },

  // ================================
  //               JUGOS
  //     (CON VARIANTE + S/2.00)
  // ================================
  {
    category: 'Jugos',
    floorLevel: 3,
    items: [
      { name: 'Papaya', price: 6.0 },
      { name: 'Plátano', price: 6.0 },
      { name: 'Mango', price: 6.0 },
      { name: 'Arándanos', price: 8.0 },
      { name: 'Fresas', price: 8.0 },
      { name: 'Piña', price: 8.0 },
      { name: 'Mix de jugos (2 frutas)', price: 12.0 },
    ],
    variants: [{ name: 'Con leche', priceExtra: 2.0 }],
  },

  // ================================
  //               ZUMOS
  // ================================
  {
    category: 'Zumos 1LT',
    floorLevel: 3,
    items: [
      { name: 'Chicha morada 1LT', price: 12.0 },
      { name: 'Maracuyá 1LT', price: 12.0 },
      { name: 'Limonada 1LT', price: 12.0 },
      { name: 'Naranjada 1LT', price: 12.0 },
      { name: 'Vaso de zumos', price: 3.0 },
    ],
  },

  // ================================
  //           BEBIDAS FRÍAS
  // ================================
  {
    category: 'Bebidas Frías',
    floorLevel: 3,
    items: [
      { name: 'Soda Italiana', price: 10.0 },
      { name: 'Frappe', price: 15.0 },
      { name: 'Refrescantes 1LT', price: 18.0 },
      { name: 'Refrescante vaso', price: 10.0 },
      { name: 'Mocktail', price: 12.0 },
    ],
  },
];

async function main() {
  console.log('🌱 Iniciando Seed de Base de Datos para Ice Mankora...');

  console.log('... Creando Pisos');
  // const floor1 = await prisma.floor.upsert({
  //   where: { level: 1 },
  //   update: {},
  //   create: { name: 'Piso 1', level: 1 },
  // });
  //
  // const floor2 = await prisma.floor.upsert({
  //   where: { level: 2 },
  //   update: {},
  //   create: { name: 'Piso 2', level: 2 },
  // });
  //
  // const floor3 = await prisma.floor.upsert({
  //   where: { level: 3 },
  //   update: {},
  //   create: { name: 'Piso 3', level: 3 },
  // });
  //
  // console.log('... Creando Usuarios');
  //
  // await prisma.user.upsert({
  //   where: { username: 'ADMIN1' },
  //   update: {},
  //   create: {
  //     name: 'Carlos Dueñas',
  //     dni: '10000001',
  //     username: 'ADMIN1',
  //     password: await bcrypt.hash('1000', 10),
  //     role: UserRole.ADMIN,
  //     floors: {
  //       connect: [{ id: floor1.id }, { id: floor2.id }, { id: floor3.id }],
  //     },
  //   },
  // });
  //
  // await prisma.user.upsert({
  //   where: { username: 'ADMIN2' },
  //   update: {},
  //   create: {
  //     name: 'Sofia',
  //     dni: '10000002',
  //     username: 'ADMIN2',
  //     password: await bcrypt.hash('1000', 10),
  //     role: UserRole.ADMIN,
  //     floors: {
  //       connect: [{ id: floor1.id }, { id: floor2.id }, { id: floor3.id }],
  //     },
  //   },
  // });
  //
  // await prisma.user.upsert({
  //   where: { username: 'CAJA1' },
  //   update: {},
  //   create: {
  //     name: 'CAJA1',
  //     dni: '20000001',
  //     username: 'CAJA1',
  //     password: await bcrypt.hash('2000', 10),
  //     role: UserRole.CAJERO,
  //     floors: {
  //       connect: [{ id: floor1.id }, { id: floor2.id }, { id: floor3.id }],
  //     },
  //   },
  // });
  //
  // await prisma.user.upsert({
  //   where: { username: 'MOZO1A' },
  //   update: {},
  //   create: {
  //     name: 'MOZO1A',
  //     dni: '30000001',
  //     username: 'MOZO1A',
  //     password: await bcrypt.hash('3000', 10),
  //     role: UserRole.MOZO,
  //     floors: {
  //       connect: [{ id: floor1.id }, { id: floor2.id }, { id: floor3.id }],
  //     },
  //   },
  // });
  //
  // await prisma.user.upsert({
  //   where: { username: 'MOZO1B' },
  //   update: {},
  //   create: {
  //     name: 'MOZO1B',
  //     dni: '30000002',
  //     username: 'MOZO1B',
  //     password: await bcrypt.hash('3000', 10),
  //     role: UserRole.MOZO,
  //     floors: {
  //       connect: [{ id: floor1.id }, { id: floor2.id }, { id: floor3.id }],
  //     },
  //   },
  // });
  //
  // await prisma.user.upsert({
  //   where: { username: 'MOZO2A' },
  //   update: {},
  //   create: {
  //     name: 'MOZO2A',
  //     dni: '40000001',
  //     username: 'MOZO2A',
  //     password: await bcrypt.hash('4000', 10),
  //     role: UserRole.MOZO,
  //     floors: {
  //       connect: [{ id: floor1.id }, { id: floor2.id }, { id: floor3.id }],
  //     },
  //   },
  // });
  //
  // await prisma.user.upsert({
  //   where: { username: 'MOZO2B' },
  //   update: {},
  //   create: {
  //     name: 'MOZO2B',
  //     dni: '40000002',
  //     username: 'MOZO2B',
  //     password: await bcrypt.hash('4000', 10),
  //     role: UserRole.MOZO,
  //     floors: {
  //       connect: [{ id: floor1.id }, { id: floor2.id }, { id: floor3.id }],
  //     },
  //   },
  // });
  //
  // // --- Mozos Piso 3 (Eventos / Apoyo) ---
  // await prisma.user.upsert({
  //   where: { username: 'MOZO3A' },
  //   update: {},
  //   create: {
  //     name: 'MOZO3A',
  //     dni: '50000001',
  //     username: 'MOZO3A',
  //     password: await bcrypt.hash('5000', 10),
  //     role: UserRole.MOZO,
  //     floors: {
  //       connect: [{ id: floor1.id }, { id: floor2.id }, { id: floor3.id }],
  //     },
  //   },
  // });
  //
  // await prisma.user.upsert({
  //   where: { username: 'MOZO3B' },
  //   update: {},
  //   create: {
  //     name: 'MOZO3B',
  //     dni: '50000002',
  //     username: 'MOZO3B',
  //     password: await bcrypt.hash('5000', 10),
  //     role: UserRole.MOZO,
  //
  //     floors: {
  //       connect: [{ id: floor1.id }, { id: floor2.id }, { id: floor3.id }],
  //     },
  //   },
  // });
  //
  // await prisma.user.upsert({
  //   where: { username: 'MOZO3C' },
  //   update: {},
  //   create: {
  //     name: 'MOZO3C',
  //     dni: '50000003',
  //     username: 'MOZO3C',
  //     password: await bcrypt.hash('5000', 10),
  //     role: UserRole.MOZO,
  //     floors: {
  //       connect: [{ id: floor1.id }, { id: floor2.id }, { id: floor3.id }],
  //     },
  //   },
  // });
  //
  // // 3. CREAR CATEGORÍAS Y PRODUCTOS (MENU)
  // console.log('... Creando Carta y Productos');
  //
  // for (const group of MENU_DATA) {
  //   // Determinar a qué ID de piso corresponde el nivel lógico
  //   let targetFloorId = floor1.id;
  //   if (group.floorLevel === 2) targetFloorId = floor2.id;
  //   if (group.floorLevel === 3) targetFloorId = floor3.id;
  //
  //   // Crear Categoría
  //   const slug = group.category
  //     .toLowerCase()
  //     .replace(/ /g, '-')
  //     .replace(/&/g, 'y');
  //
  //   // Usamos findFirst para ver si existe por slug, si no upsert
  //   // (Nota: Upsert requiere @unique, slug debería serlo, pero usaremos lógica simple aquí)
  //   let category = await prisma.category.findFirst({ where: { slug } });
  //
  //   if (!category) {
  //     category = await prisma.category.create({
  //       data: {
  //         name: group.category,
  //         slug: slug,
  //         floors: { connect: [{ id: targetFloorId }] }, // Conectamos al piso correspondiente
  //       },
  //     });
  //   }
  //
  //   // Crear Productos dentro de la categoría
  //   for (const item of group.items) {
  //     // Buscamos si existe para no duplicar (usando nombre como llave única lógica aquí)
  //     const existingProduct = await prisma.product.findFirst({
  //       where: { name: item.name, categoryId: category.id },
  //     });
  //
  //     if (!existingProduct) {
  //       await prisma.product.create({
  //         data: {
  //           name: item.name,
  //           price: item.price,
  //           categoryId: category.id,
  //           stockDaily: 50,
  //           stockWarehouse: 100,
  //           description: `Delicioso ${item.name} estilo Ice Mankora`,
  //           isActive: true,
  //           taxType: 'GRAVADO',
  //           igvRate: 0.18,
  //         },
  //       });
  //     }
  //   }
  // }
  //
  // // 4. CREAR MESAS
  // console.log('... Creando Mesas');
  //
  // // Función helper para crear mesas
  // // const createTables = async (
  // //   floorId: string,
  // //   startNum: number,
  // //   count: number,
  // // ) => {
  // //   for (let i = 0; i < count; i++) {
  // //     const num = startNum + i;
  // //     // Upsert basado en la restricción única [floorId, number]
  // //     const existingTable = await prisma.table.findUnique({
  // //       where: {
  // //         floorId_number: {
  // //           floorId: floorId,
  // //           number: num,
  // //         },
  // //       },
  // //     });
  //
  // //     if (!existingTable) {
  // //       await prisma.table.create({
  // //         data: {
  // //           number: num,
  // //           name: `Mesa ${num}`,
  // //           floorId: floorId,
  // //           posX: (i % 5) * 100, // Coordenadas dummy para el mapa
  // //           posY: Math.floor(i / 5) * 100,
  // //         },
  // //       });
  // //     }
  // //   }
  // // };
  //
  // // await createTables(floor1.id, 1, 10); // Mesas 1-10 en Piso 1
  // // await createTables(floor2.id, 20, 29); // Mesas 1-10 en Piso 2 (Numérico se repite, pero piso es diferente)
  // // await createTables(floor3.id, 30, 39); // Mesas 1-8 en Piso 3
  //
  // // Función helper para crear mesas con numeración personalizada
  // const createTables = async (
  //   floorId: string,
  //   startNum: number,
  //   endNum: number,
  // ) => {
  //   let i = 0;
  //   for (let num = startNum; num <= endNum; num++, i++) {
  //     const existingTable = await prisma.table.findUnique({
  //       where: {
  //         floorId_number: {
  //           floorId,
  //           number: num,
  //         },
  //       },
  //     });
  //
  //     if (!existingTable) {
  //       await prisma.table.create({
  //         data: {
  //           number: num,
  //           name: `Mesa ${num}`,
  //           floorId,
  //           posX: (i % 5) * 100, // Coordenadas dummy
  //           posY: Math.floor(i / 5) * 100,
  //         },
  //       });
  //     }
  //   }
  // };
  //
  // // Piso 1: mesas 1–10
  // await createTables(floor1.id, 1, 10);
  //
  // // Piso 2: mesas 20–29
  // await createTables(floor2.id, 20, 29);
  //
  // // Piso 3: mesas 30–39
  // await createTables(floor3.id, 30, 39);
  //
  // await prisma.systemConfig.upsert({
  //   where: { key: 'ADMIN_PIN' },
  //   update: {},
  //   create: {
  //     key: 'ADMIN_PIN',
  //     value: '9999',
  //     description: 'PIN maestro para anulaciones y acciones sensibles',
  //   },
  // });
  //
  // // Configurar impresoras para cada piso
  // await prisma.floor.update({
  //   where: { level: 1 },
  //   data: {
  //     printerIp: '192.168.1.10',
  //     printerPort: 9100,
  //   },
  // });
  //
  // await prisma.floor.update({
  //   where: { level: 2 },
  //   data: {
  //     printerIp: '192.168.1.11',
  //     printerPort: 9100,
  //   },
  // });
  //
  // await prisma.floor.update({
  //   where: { level: 3 },
  //   data: {
  //     printerIp: '192.168.1.12',
  //     printerPort: 9100,
  //   },
  // });

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

