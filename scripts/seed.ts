import { config } from "dotenv";

// Must run before anything touches process.env.DATABASE_URL.
config({ path: ".env.local" });

const CATALOG = [
  {
    slug: "monstera-deliciosa",
    name: "Monstera Deliciosa",
    category: "Plants",
    priceCents: 4800,
    description:
      "A split-leaf classic that grows into the room. Ships in a nursery pot at roughly 60cm, already past the fussy stage.",
  },
  {
    slug: "fiddle-leaf-fig",
    name: "Fiddle Leaf Fig",
    category: "Plants",
    priceCents: 7200,
    description:
      "Tall, architectural, and famously opinionated about being moved. Give it one bright corner and leave it there.",
  },
  {
    slug: "snake-plant-laurentii",
    name: "Snake Plant 'Laurentii'",
    category: "Plants",
    priceCents: 3200,
    description:
      "The one that survives you forgetting it exists. Tolerates low light, irregular watering, and radiators.",
  },
  {
    slug: "zz-plant",
    name: "ZZ Plant",
    category: "Plants",
    priceCents: 3600,
    description:
      "Waxy, upright foliage on a plant that stores its own water. Good for hallways and north-facing rooms.",
  },
  {
    slug: "string-of-pearls",
    name: "String of Pearls",
    category: "Plants",
    priceCents: 2800,
    description:
      "A trailing succulent for a high shelf. Wants bright light and a pot that drains properly.",
  },
  {
    slug: "stoneware-planter-ochre",
    name: "Stoneware Planter, Ochre",
    category: "Vessels",
    priceCents: 5400,
    description:
      "Hand-thrown stoneware with a matte ochre glaze. Drainage hole and a matching saucer included.",
  },
  {
    slug: "stoneware-planter-slate",
    name: "Stoneware Planter, Slate",
    category: "Vessels",
    priceCents: 5400,
    description:
      "The same hand-thrown form in a cool slate glaze. Fits a 16cm nursery pot without repotting.",
  },
  {
    slug: "terracotta-trio",
    name: "Terracotta Trio",
    category: "Vessels",
    priceCents: 3900,
    description:
      "Three unglazed terracotta pots in graduated sizes. Porous walls let roots breathe and dry out evenly.",
  },
  {
    slug: "woven-basket-planter",
    name: "Woven Basket Planter",
    category: "Vessels",
    priceCents: 4400,
    description:
      "Seagrass basket with a sealed plastic liner, so you can drop a nursery pot straight in.",
  },
  {
    slug: "brass-mister",
    name: "Brass Plant Mister",
    category: "Care",
    priceCents: 3400,
    description:
      "Solid brass with a fine brass nozzle. Develops a patina, holds 300ml, and does not look like a spray bottle.",
  },
  {
    slug: "copper-watering-can",
    name: "Copper Watering Can",
    category: "Care",
    priceCents: 6200,
    description:
      "A narrow spout for getting under leaves and into crowded pots. 1.5 litres of hammered copper.",
  },
  {
    slug: "soil-moisture-meter",
    name: "Soil Moisture Meter",
    category: "Care",
    priceCents: 1800,
    description:
      "Settles the only argument that matters. No batteries, no app, just a probe and a dial.",
  },
] as const;

async function seed() {
  // Imported dynamically, not at the top of the file: a static import is
  // hoisted above the dotenv call above, so lib/db would be evaluated before
  // DATABASE_URL exists and would throw on a perfectly valid .env.local.
  const { db } = await import("../lib/db");
  const { products } = await import("../lib/db/schema");

  console.log(`Seeding ${CATALOG.length} products...`);

  for (const item of CATALOG) {
    const row = {
      ...item,
      imageUrl: `https://picsum.photos/seed/${item.slug}/800/800`,
    };

    // Upsert by slug. Products are never deleted, because order_items
    // reference them with ON DELETE RESTRICT.
    await db
      .insert(products)
      .values(row)
      .onConflictDoUpdate({ target: products.slug, set: row });

    console.log(`  ok  ${item.slug}`);
  }

  console.log("Done.");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
