const CACHE = "finance-premium-v2";
const ARQUIVOS = ["./", "./index.html", "./style.css", "./script.js", "./manifest.webmanifest", "./icons/icon.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARQUIVOS))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(chaves => Promise.all(chaves.filter(chave => chave !== CACHE).map(chave => caches.delete(chave)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => event.respondWith(caches.match(event.request).then(resposta => resposta || fetch(event.request))));
