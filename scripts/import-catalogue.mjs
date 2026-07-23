import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const csvPath = path.join(root, "images", "catalogue.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const rows = parseCsv(fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, ""));
const products = rows.slice(1).filter((row) => row.length >= 6).map((row) => ({
  number: Number(row[0]),
  imageFile: row[1],
  caption: row[2].replace(/\r/g, "").trim(),
  width: Number(row[3]),
  height: Number(row[4]),
  sha256: row[5],
}));

const nameOverrides = {
  1: "3-Piece Plain Curtains with Sheer",
  3: "3-Piece Plain Curtains with Sheer",
  6: "Eurochef 2-in-1 Blender",
  18: "60 x 60 Freestanding Cooker with Electric Oven",
  19: "50 x 55 Freestanding Cooker with Electric Oven",
  22: "American 5 x 8 Carpet",
  24: "White Striped Duvet Set",
  27: "1.6L Tea and Coffee Pot",
  46: "7 x 10 Carpet",
  48: "7 x 10 Carpet",
  49: "7 x 10 Carpet",
  52: "Cone-Shaped Stainless Steel Grater",
  70: "Bottom-Load Water Dispenser",
  63: "Tornado 14-Piece Cookware Set",
  69: "Electromate 3 Gas + 1 Electric Standing Cooker",
  71: "Multipurpose 5-Piece Shower Caddy Set",
  83: "12-Piece Trendy White Dinner Set",
  96: "Expandable Cutlery Drawer",
  108: "Portable Electric Breast Pump",
  116: "Flannel Duvet Set",
  117: "Flannel Duvet Set",
  119: "Flannel Duvet Set",
  121: "6-Piece Black Rimmed Bowl Set",
  124: "Tufted Duvet Set",
  126: "Tufted Duvet Set",
  127: "Tufted Duvet Set",
  128: "Tufted Duvet Set",
  132: "Smartpro 90L Single-Door Fridge",
  134: "Syinix 137L Double-Door Fridge",
  135: "Mika 197L Fridge",
  137: "Von 197L No-Frost Fridge",
  147: "Happy Home 6-Piece Stainless Steel Hotpot Set",
  151: "Milton Pearl 8-Piece Combo",
  152: "Redberry Milton Pearl 4-Piece Hotpot Set",
  155: "Glass Oil Dispenser",
  158: "High Quality Food Warmer",
  159: "Knife and Kitchen Utensil Set",
  160: "Knife and Kitchen Utensil Set",
  161: "Marble-Finish Coffee Table",
  164: "Over-Toilet Storage Rack",
  166: "3-Tier Kitchen Dish Rack",
  165: "2-Piece Non-Slip Kitchen Mat Set",
  173: "5 x 8 Fluffy Carpet",
  170: "Electromate Hot and Normal Water Dispenser",
};

const priceOverrides = {
  4: 2500,
  7: 15000,
  22: 4000,
  24: 2500,
  46: 4500,
  48: 4500,
  49: 4500,
  51: 5000,
  57: 1200,
  83: 2000,
  88: 5000,
  90: 1500,
  116: 3500,
  117: 3500,
  119: 3500,
  120: 1500,
  124: 4000,
  126: 4000,
  127: 4000,
  162: 600,
  173: 2000,
  174: 800,
};

const genericFilename = /^(?:new(?:-| )?(?:in|arrival|arrivals)?|restocked|in stock|offer|hot deal|price drop|reduced prices|\d[\d -]*|\d{1,2}-\d{2}-(?:am|pm))$/i;

function cleanCaption(caption) {
  return caption
    .replace(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi, "")
    .replace(/[️✓•*_~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value) {
  const preserve = new Set([
    "Ailyons", "Bosch", "Dessini", "Electromate", "Eurochef", "Icona",
    "JTC", "Linex", "Mika", "NSFE", "Raf", "Ramtons", "Raha", "Redberry",
    "Samsung", "Sayona", "Signature", "Smartpro", "Sokany", "Syinix", "Von",
  ]);
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const known = [...preserve].find((item) => item.toLowerCase() === word.toLowerCase());
      if (known) return known;
      if (/^\d+(?:pc|pcs|l|ltr|litres?|ml|w)$/i.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function deriveName(product) {
  if (nameOverrides[product.number]) return nameOverrides[product.number];
  const basename = path.basename(product.imageFile, path.extname(product.imageFile))
    .replace(/^\d{4}-/, "")
    .replace(/-/g, " ")
    .replace(/\b(?:restocked|new arrivals?|new in|in stock|price drop)\b/gi, "")
    .replace(/\b\d{3,6}\b(?:\s*ksh)?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (basename && !genericFilename.test(basename) && basename.length > 4) {
    return titleCase(basename);
  }
  const caption = cleanCaption(product.caption)
    .replace(/^(?:new(?: in| arrival| arrivals)?|restocked|hot deal|offer|price drop)[\s.:,-]*/i, "")
    .replace(/^(?:tukisema crazy offers)\s*/i, "");
  const candidate = caption
    .split(/\b(?:offer price|promotion price|price|available|capacity|features|contains|comprises|material|colour|colors?)\b/i)[0]
    .replace(/[@=].*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return titleCase(candidate.slice(0, 76)) || `Catalogue Product ${product.number}`;
}

function derivePrice(product) {
  if (priceOverrides[product.number]) return priceOverrides[product.number];
  const caption = cleanCaption(product.caption);
  const patterns = [
    /(?:offer price|promotion price|selling|price drop|price(?: per piece)?|now available)\D{0,18}(?:kshs?\.?\s*)?([\d,]{3,})/gi,
    /@\s*(?:kshs?\.?\s*)?([\d,]{3,})/gi,
    /(?:kshs?\.?\s*)([\d,]{3,})/gi,
    /([\d,]{3,})\s*(?:kshs?|\/=)/gi,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(caption);
    if (match) {
      const value = Number(match[1].replace(/,/g, ""));
      if (value >= 500 && value <= 200000) return value;
    }
  }
  if (/^\s*[\d,]{3,}\s*$/.test(caption)) {
    return Number(caption.replace(/,/g, ""));
  }
  return 0;
}

const categoryRules = [
  ["curtains-bedding", "Curtains & Bedding", /curtain|duvet|bedsheet|blanket|mattress|mosquito net/i],
  ["large-appliances", "Large Appliances", /fridge|refrigerator|standing cooker|free-standing cooker|water dispenser|tallboy|sound bar|microwave|electric oven/i],
  ["small-appliances", "Small Appliances", /blender|airfryer|air fryer|kettle|toaster|sandwich maker|juicer|iron|fan|burner|pressure cooker|ugali cooker|hair remover/i],
  ["cookware", "Cookware", /cookware|casserole|pot\b|pan\b|sufuria|chapati|tea urn|coffee pot/i],
  ["dining-serveware", "Dining & Serveware", /dinner|plate|bowl|mug|cup|glass|cutlery|fork|hotpot|hot pot|food warmer|flask|water bottle|water jug|serving dish|serviette|table set/i],
  ["storage-organisation", "Storage & Organisation", /rack|organiser|organizer|holder|shelf|dishrack|dish rack|chopping board|shower caddy|fruit rack/i],
  ["bags-travel", "Bags & Travel", /bag|suitcase/i],
  ["home-living", "Home & Living", /carpet|mat\b|tv stand/i],
  ["personal-baby", "Personal & Baby Care", /breast pump|smart watch/i],
];

function deriveCategory(name, description) {
  const match = categoryRules.find(([, , pattern]) => pattern.test(name))
    || categoryRules.find(([, , pattern]) => pattern.test(description));
  return match ? { slug: match[0], name: match[1] } : {
    slug: "household-essentials",
    name: "Household Essentials",
  };
}

function slugify(value, number) {
  const slug = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${slug || "product"}-${String(number).padStart(4, "0")}`;
}

function buildStoreProducts() {
  const storeProducts = products.map((product, index) => {
    const name = deriveName(product);
    const description = cleanCaption(product.caption);
    const category = deriveCategory(name, description);
    const price = derivePrice(product);
    const isNew = /\bnew(?: in| arrival| arrivals)?\b/i.test(description);
    const isSale = /\boffer|price drop|promotion\b/i.test(description);
    return {
      id: `p-${String(product.number).padStart(4, "0")}`,
      slug: slugify(name, product.number),
      name,
      sku: `MK-${String(product.number).padStart(4, "0")}`,
      category: category.name,
      categorySlug: category.slug,
      price,
      previousPrice: null,
      discount: null,
      badge: isNew ? "new" : isSale ? "sale" : "",
      rating: 5,
      reviewCount: 0,
      stockStatus: "in-stock",
      stockQuantity: 99,
      images: [`/media/catalogue/${path.basename(product.imageFile)}`],
      shortDescription: description.slice(0, 190),
      fullDescription: description,
      material: "",
      dimensions: `${product.width} × ${product.height} product image`,
      colors: [],
      careInstructions: "Please contact our team on WhatsApp for product care guidance.",
      deliveryInfo: "Availability and order details are confirmed on WhatsApp.",
      relatedProducts: [],
      frequentlyBought: [],
      isNew,
      isSale,
      isBestSeller: index < 16,
    };
  });
  for (const product of storeProducts) {
    const related = storeProducts
      .filter((candidate) => (
        candidate.id !== product.id
        && candidate.categorySlug === product.categorySlug
      ))
      .slice(0, 4)
      .map((candidate) => candidate.id);
    product.relatedProducts = related;
    product.frequentlyBought = related.slice(0, 3);
  }
  return storeProducts;
}

function buildCategories(storeProducts) {
  const descriptions = {
    "curtains-bedding": "Curtains, duvets, bedsheets, blankets and bedroom essentials.",
    "large-appliances": "Fridges, cookers, dispensers, microwaves and larger home appliances.",
    "small-appliances": "Blenders, kettles, air fryers and convenient countertop appliances.",
    cookware: "Cookware sets, pots, pans and cooking essentials for every kitchen.",
    "dining-serveware": "Dinner sets, drinkware, cutlery, hotpots and serving essentials.",
    "storage-organisation": "Racks, holders and practical organisers for a tidier home.",
    "bags-travel": "School bags, suitcases and everyday travel essentials.",
    "home-living": "Carpets, mats, furniture and useful household additions.",
    "personal-baby": "Personal accessories and practical baby-care products.",
    "household-essentials": "A varied selection of useful products for everyday home life.",
  };
  return [...new Map(storeProducts.map((product) => [
    product.categorySlug,
    product.category,
  ])).entries()].map(([slug, name], index) => {
    const categoryProducts = storeProducts.filter((product) => product.categorySlug === slug);
    return {
      id: `cat-${index + 1}`,
      slug,
      name,
      description: descriptions[slug],
      image: categoryProducts[0].images[0],
      productCount: categoryProducts.length,
      featured: index < 8,
    };
  });
}

if (process.argv.includes("--inspect")) {
  for (const product of products) {
    const summary = product.caption.replace(/\s+/g, " ").trim();
    console.log(
      `${String(product.number).padStart(4, "0")} | ${path.basename(product.imageFile)} | ${summary}`,
    );
  }
  console.error(`Parsed ${products.length} catalogue products.`);
}

if (process.argv.includes("--json")) {
  const storeProducts = buildStoreProducts();
  console.log(JSON.stringify({
    products: storeProducts,
    categories: buildCategories(storeProducts),
  }, null, 2));
}

export { buildCategories, buildStoreProducts, parseCsv, products };
