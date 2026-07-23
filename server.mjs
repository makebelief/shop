import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = resolve(projectRoot, "public");
const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const host = process.env.HOST ?? "0.0.0.0";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "manifest-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = {
  "Content-Security-Policy": contentSecurityPolicy,
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  "Permissions-Policy": [
    "camera=()",
    "geolocation=()",
    "microphone=()",
    "payment=()",
    "usb=()",
  ].join(", "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-DNS-Prefetch-Control": "off",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-XSS-Protection": "0",
};
const exactSpaRoutes = new Set([
  "/", "/about", "/blog", "/cart", "/checkout",
  "/contact", "/cookies", "/faq", "/new-arrivals",
  "/offers", "/order-confirmed", "/payment-failed", "/privacy",
  "/search", "/shop", "/terms", "/track-order",
]);

function isKnownSpaRoute(pathname) {
  const route = pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  return exactSpaRoutes.has(route) ||
    route.startsWith("/blog/") ||
    route.startsWith("/categories/") ||
    route.startsWith("/products/");
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".eot": "application/vnd.ms-fontobject",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function safePublicPath(pathname) {
  try {
    const decoded = decodeURIComponent(pathname);
    const relativePath = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
    const candidate = resolve(join(publicRoot, relativePath));
    const isInsidePublicRoot = candidate === publicRoot ||
      candidate.startsWith(`${publicRoot}${sep}`);
    return isInsidePublicRoot ? candidate : null;
  } catch {
    return null;
  }
}

function applySecurityHeaders(response) {
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.setHeader(name, value);
  }
}

function sendFile(request, response, filePath, statusCode = 200) {
  const extension = extname(filePath).toLowerCase();
  const isAsset = filePath.includes(`${publicRoot}/assets/`) ||
    filePath.includes(`${publicRoot}/brand/`) ||
    filePath.includes(`${publicRoot}/media/`) ||
    filePath.includes(`${publicRoot}/vendor/`);

  response.writeHead(statusCode, {
    "Cache-Control": isAsset
      ? "public, max-age=31536000, immutable"
      : "no-cache",
    "Content-Length": statSync(filePath).size,
    "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

function handleRequest(request, response) {
  applySecurityHeaders(response);

  if (!request.url || !["GET", "HEAD"].includes(request.method ?? "")) {
    response.writeHead(405, {
      "Allow": "GET, HEAD",
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end("Method Not Allowed");
    return;
  }

  if (request.url.length > 2048) {
    response.writeHead(414, {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end("URI Too Long");
    return;
  }

  const { pathname } = new URL(request.url, "http://localhost");

  // Permanently replace URLs inherited from the downloaded preview mirror.
  if (pathname.startsWith("/preview/") || pathname.startsWith("/127.0.0.1_8081/")) {
    response.writeHead(301, {
      "Cache-Control": "no-store",
      "Location": "/",
    });
    response.end();
    return;
  }

  if (pathname === "/health") {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  const requestedPath = safePublicPath(pathname);
  if (requestedPath && existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    sendFile(request, response, requestedPath);
    return;
  }

  // Missing static resources must not masquerade as successful HTML responses.
  if (extname(pathname)) {
    response.writeHead(404, {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
    response.end("404 — File Not Found");
    return;
  }

  // Known client-side routes receive the SPA. Unknown routes render the
  // application branded Page Not Found screen with the correct HTTP status.
  const isKnownRoute = isKnownSpaRoute(pathname);
  sendFile(request, response, join(publicRoot, "index.html"), isKnownRoute ? 200 : 404);
}

const server = createServer((request, response) => {
  try {
    handleRequest(request, response);
  } catch {
    if (!response.headersSent) {
      applySecurityHeaders(response);
      response.writeHead(500, {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      });
    }
    response.end("Internal Server Error");
  }
});

server.headersTimeout = 10_000;
server.requestTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;

server.on("clientError", (error, socket) => {
  if (!socket.writable) return;
  const status = error.code === "HPE_HEADER_OVERFLOW"
    ? "431 Request Header Fields Too Large"
    : "400 Bad Request";
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
});

server.listen(port, host, () => {
  console.log(`Mitchy Kitchen is running at http://${host}:${port}`);
});
