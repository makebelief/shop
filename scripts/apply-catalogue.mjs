import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  buildCategories,
  buildStoreProducts,
  products as sourceProducts,
} from "./import-catalogue.mjs";

const root = process.cwd();
const bundlePath = path.join(root, "public", "assets", "app-clean.js");
const mediaDir = path.join(root, "public", "media", "catalogue");
const storeProducts = buildStoreProducts();
const categories = buildCategories(storeProducts);

fs.mkdirSync(mediaDir, { recursive: true });

for (const product of sourceProducts) {
  const source = path.join(root, product.imageFile);
  const destination = path.join(mediaDir, path.basename(product.imageFile));
  const actualHash = crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex");
  if (actualHash !== product.sha256) {
    throw new Error(`Image checksum mismatch: ${product.imageFile}`);
  }
  fs.copyFileSync(source, destination);
}

let bundle = fs.readFileSync(bundlePath, "utf8");

function replaceOnce(source, replacement, label) {
  const matches = bundle.split(source).length - 1;
  if (matches !== 1) {
    throw new Error(`${label}: expected one match, found ${matches}`);
  }
  bundle = bundle.replace(source, replacement);
}

function removeIfPresent(source, label) {
  const matches = bundle.split(source).length - 1;
  if (matches > 1) {
    throw new Error(`${label}: expected at most one match, found ${matches}`);
  }
  if (matches === 1) bundle = bundle.replace(source, "");
}

const catalogueStart = bundle.indexOf("rs=[");
const catalogueEndMarker = "as=[...rs,...is];";
const catalogueEnd = bundle.indexOf(catalogueEndMarker, catalogueStart);
if (catalogueStart < 0 || catalogueEnd < 0) {
  throw new Error("Could not locate the compiled product catalogue.");
}

const productData = `rs=${JSON.stringify(storeProducts)},is=[],as=[...rs,...is];`;
bundle = `${bundle.slice(0, catalogueStart)}${productData}${bundle.slice(catalogueEnd + catalogueEndMarker.length)}`;

const categoryStart = bundle.indexOf("var gs=[");
const categoryEndMarker = "];function _s()";
const categoryEnd = bundle.indexOf(categoryEndMarker, categoryStart);
if (categoryStart < 0 || categoryEnd < 0) {
  throw new Error("Could not locate the compiled category catalogue.");
}

bundle = `${bundle.slice(0, categoryStart)}var gs=${JSON.stringify(categories)};function _s()${bundle.slice(categoryEnd + categoryEndMarker.length)}`;

removeIfPresent(
  ",{label:`Product Bundles`,to:`/bundles`}",
  "footer bundle link",
);
removeIfPresent(
  "{label:`Kitchen Bundles`,icon:`ri-gift-line`,to:`/bundles`,color:`#FF6600`},",
  "homepage bundle shortcut",
);

const homeStart = bundle.indexOf("function Js()");
const homeEnd = bundle.indexOf("function Ys()", homeStart);
if (homeStart < 0 || homeEnd < 0) {
  throw new Error("Could not locate the homepage component.");
}
const home = bundle.slice(homeStart, homeEnd);
const homeWithoutBundles = home
  .replace(",(0,D.jsx)(Rs,{})", "")
  .replace(",(0,D.jsx)(Ks,{})", "");
bundle = `${bundle.slice(0, homeStart)}${homeWithoutBundles}${bundle.slice(homeEnd)}`;

removeIfPresent(
  ",{path:`/bundles`,element:(0,D.jsx)(lc,{})}",
  "bundle route",
);

removeIfPresent(
  "(0,D.jsx)(`div`,{className:`hidden md:block text-center py-2 text-sm font-medium text-white`,style:{backgroundColor:`#151515`},children:z.announcementBar}),",
  "delivery announcement bar",
);
removeIfPresent(
  "(0,D.jsxs)(R,{to:`/track-order`,className:`flex items-center gap-1.5 text-sm font-medium text-[#151515] hover:text-[#FF6600] transition-colors whitespace-nowrap`,children:[(0,D.jsx)(`div`,{className:`w-5 h-5 flex items-center justify-center`,children:(0,D.jsx)(`i`,{className:`ri-map-pin-2-line text-base`})}),`Track Order`]}),",
  "desktop track-order navigation link",
);
removeIfPresent(
  ",{label:`Track Order`,to:`/track-order`,icon:`ri-map-pin-2-line`}",
  "mobile track-order navigation link",
);
removeIfPresent(
  "{label:`Contact Us`,to:`/contact`},",
  "footer contact-page link",
);
removeIfPresent(
  ",{label:`Contact Us`,to:`/contact`,icon:`ri-mail-line`}",
  "mobile contact-page link",
);
removeIfPresent(
  "{label:`Delivery Information`,to:`/delivery-info`,icon:`ri-truck-line`},",
  "mobile delivery-information link",
);
removeIfPresent(
  ",{label:`Returns & Refunds`,to:`/returns`,icon:`ri-refresh-line`}",
  "mobile returns link",
);
removeIfPresent(
  ",{label:`Returns Policy`,to:`/returns`}",
  "footer returns-policy link",
);
removeIfPresent(
  ",{path:`/delivery-info`,element:(0,D.jsx)(mc,{})}",
  "delivery-information route",
);
removeIfPresent(
  ",{path:`/returns`,element:(0,D.jsx)(gc,{})}",
  "returns-policy route",
);

const faqStart = bundle.indexOf("var fc=[");
const faqEnd = bundle.indexOf("];function pc()", faqStart);
if (faqStart < 0 || faqEnd < 0) {
  throw new Error("Could not locate the FAQ catalogue.");
}
const safeFaqs = [
  {
    q: "Do I need to create an account to shop?",
    a: "No. You can browse products, add items to your cart and send your order through WhatsApp without creating an account.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Payment options are confirmed by our customer-care team after you send your order through WhatsApp. Do not send payment until our team provides official instructions.",
  },
  {
    q: "How do I pay via M-Pesa?",
    a: "Send your order through WhatsApp. Our customer-care team will confirm availability and provide the correct M-Pesa payment instructions in the chat.",
  },
  {
    q: "Can I order via WhatsApp?",
    a: "Yes. Use any WhatsApp order button to send the selected product or your complete cart directly to our customer-care team.",
  },
  {
    q: "How do I track my order?",
    a: "Contact our customer-care team on WhatsApp with your order number for an update.",
  },
  {
    q: "Do your products come with a warranty?",
    a: "Some products include a manufacturer warranty. Contact our customer-care team to confirm the warranty available for a specific item.",
  },
];
bundle = `${bundle.slice(0, faqStart)}var fc=${JSON.stringify(safeFaqs)};function pc()${bundle.slice(faqEnd + "];function pc()".length)}`;

const contactStart = bundle.indexOf("function dc()");
const contactEnd = bundle.indexOf("var fc=", contactStart);
if (contactStart < 0 || contactEnd < 0) {
  throw new Error("Could not locate the contact-page component.");
}
const whatsappContactPage = "function dc(){return(0,D.jsx)(V,{children:(0,D.jsxs)(`div`,{className:`container-mitchy py-16 max-w-xl text-center`,children:[(0,D.jsx)(`div`,{className:`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4`,style:{backgroundColor:`#25D366`},children:(0,D.jsx)(`i`,{className:`ri-whatsapp-line text-3xl text-white`})}),(0,D.jsx)(`h1`,{className:`text-2xl md:text-3xl font-bold text-[#151515]`,children:`Contact Us on WhatsApp`}),(0,D.jsx)(`p`,{className:`text-sm text-[#6B7280] mt-3 mb-6`,children:`Questions, product enquiries and customer support are handled directly by our customer-care team on WhatsApp.`}),(0,D.jsxs)(`a`,{href:`https://wa.me/${z.whatsapp}?text=Hello%20Mitchy%20Kitchen%2C%20I%20need%20assistance.`,target:`_blank`,rel:`noopener noreferrer`,className:`inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white whitespace-nowrap`,style:{backgroundColor:`#25D366`},children:[(0,D.jsx)(`i`,{className:`ri-whatsapp-line text-lg`}),`Open WhatsApp Chat`]})]})})}";
bundle = `${bundle.slice(0, contactStart)}${whatsappContactPage}${bundle.slice(contactEnd)}`;

removeIfPresent(
  "(0,D.jsx)(`p`,{className:`text-sm text-[#6B7280] leading-relaxed`,children:`We deliver across Kenya. Every order is confirmed personally through WhatsApp, where our team provides delivery and payment instructions.`})",
  "about-page delivery statement",
);
removeIfPresent(
  ",{icon:`ri-truck-line`,title:`Reliable Delivery`,desc:`Fast and safe delivery to your doorstep across Kenya.`}",
  "about-page delivery value",
);

bundle = bundle
  .replace("phone:`[YOUR PHONE NUMBER]`", "phone:`+254 790 461412`")
  .replace("email:`[YOUR EMAIL ADDRESS]`", "email:``")
  .replace(
    "address:`[YOUR PHYSICAL ADDRESS], [TOWN], Kenya`",
    "address:`Nairobi, Kenya`",
  )
  .replace(
    "Practical, stylish and reliable kitchen and household products designed to make everyday living easier. Delivering quality across Kenya.",
    "Practical, stylish and reliable kitchen and household products designed to make everyday living easier.",
  )
  .replace(
    "Shop quality kitchenware, cookware, food storage, dining products & household accessories in Kenya. Fast delivery. M-Pesa accepted. KSh prices.",
    "Shop quality kitchenware, cookware, food storage, dining products and household accessories in Kenya. WhatsApp-assisted ordering with KSh prices.",
  )
  .replaceAll(
    "Please confirm availability, delivery cost and payment instructions.",
    "Please confirm availability and payment instructions.",
  )
  .replace(
    "[{icon:`ri-truck-line`,text:p.deliveryInfo},{icon:`ri-shield-check-line`,text:`Payment and delivery details are confirmed securely by our team on WhatsApp`},{icon:`ri-refresh-line`,text:`Check returns policy for details on eligible returns`}]",
    "[{icon:`ri-shield-check-line`,text:`Availability, payment and order details are confirmed securely by our team on WhatsApp`}]",
  )
  .replace(
    "Your order is reviewed personally by our customer-care team, who confirms availability, delivery and payment through WhatsApp.",
    "Your order is reviewed personally by our customer-care team, who confirms availability and payment through WhatsApp.",
  )
  .replace(
    "Quality Kitchenware Delivered in Kenya",
    "Quality Kitchenware for Kenyan Homes",
  )
  .replace(
    "{value:`Kenya`,label:`Wide Delivery`}",
    "{value:`Kenya`,label:`Local Store`}",
  )
  .replaceAll(
    "(0,D.jsx)(R,{to:`/contact`,",
    "(0,D.jsx)(`a`,{href:`https://wa.me/${z.whatsapp}?text=Hello%20Mitchy%20Kitchen%2C%20I%20need%20assistance.`,target:`_blank`,rel:`noopener noreferrer`,",
  );

removeIfPresent(
  ",(0,D.jsx)(`div`,{className:`mt-5 flex items-center gap-3`,children:[{icon:`ri-facebook-circle-fill`,href:z.socialMedia.facebook,label:`Facebook`},{icon:`ri-instagram-fill`,href:z.socialMedia.instagram,label:`Instagram`},{icon:`ri-twitter-x-fill`,href:z.socialMedia.twitter,label:`Twitter / X`},{icon:`ri-tiktok-fill`,href:z.socialMedia.tiktok,label:`TikTok`},{icon:`ri-youtube-fill`,href:z.socialMedia.youtube,label:`YouTube`}].map(e=>(0,D.jsx)(`a`,{href:e.href,target:`_blank`,rel:`noopener noreferrer`,\"aria-label\":e.label,className:`w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-[#FF6600] hover:text-[#FF6600] transition-colors`,children:(0,D.jsx)(`i`,{className:`${e.icon} text-base`})},e.label))})",
  "footer social-media icons",
);
removeIfPresent(
  ",(0,D.jsxs)(`p`,{className:`text-sm text-[#6B7280]`,children:[(0,D.jsx)(`span`,{className:`font-medium`,children:`Email:`}),` `,z.email]})",
  "footer email line",
);
removeIfPresent(
  ",{icon:`ri-mail-line`,title:`Email`,value:z.email}",
  "contact-page email card",
);
bundle = bundle.replace(
  "To exercise these rights, contact us at ${z.email}.",
  "To exercise these rights, contact our customer-care team on WhatsApp.",
);

bundle = bundle
  .replace(
    "[`cookware`,`kitchen-utensils`,`knives-cutting-tools`]",
    "[`cookware`,`dining-serveware`,`small-appliances`]",
  )
  .replace(
    "[`home-organisation`,`cleaning-essentials`,`food-storage`]",
    "[`storage-organisation`,`curtains-bedding`,`home-living`,`household-essentials`]",
  );

fs.writeFileSync(bundlePath, bundle);

console.log(`Imported ${storeProducts.length} products across ${categories.length} categories.`);
console.log(`Copied and verified ${sourceProducts.length} catalogue images.`);
console.log("Removed bundle links, homepage section and route.");
