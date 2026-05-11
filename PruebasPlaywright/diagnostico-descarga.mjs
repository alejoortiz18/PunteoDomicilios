import https from 'https';
import { stringify } from 'querystring';

const PDF_PATH = 'soportes/2026/05/04/K8227073.pdf';

function get(url, cookies = '') {
  return new Promise(resolve => {
    const u = new URL(url);
    const options = {
      host: u.hostname,
      path: u.pathname + u.search,
      headers: { Cookie: cookies, 'User-Agent': 'Mozilla/5.0' },
    };
    https.get(options, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          ct: res.headers['content-type'] ?? '',
          cookies: res.headers['set-cookie'] ?? [],
          location: res.headers['location'] ?? '',
          firstBytes: body.slice(0, 8).toString('ascii'),
          bodyLength: body.length,
        });
      });
    }).on('error', e => resolve({ error: e.message }));
  });
}

function post(url, data, cookies = '') {
  return new Promise(resolve => {
    const body = stringify(data);
    const u = new URL(url);
    const req = https.request({
      host: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        Cookie: cookies,
        Referer: url,
        'User-Agent': 'Mozilla/5.0',
      },
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({
        status: res.statusCode,
        cookies: res.headers['set-cookie'] ?? [],
        location: res.headers['location'] ?? '',
      }));
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

function parseCookies(setCookieHeaders) {
  return setCookieHeaders.map(c => c.split(';')[0]).join('; ');
}

async function main() {
  console.log('=== Diagnóstico descarga PDF intranet ===\n');

  // 1. Sin autenticación (sigue el redirect automáticamente por Node HTTPS — no)
  //    Node NO sigue redirects automáticamente, así que vemos el 302.
  console.log('1) GET /ver-pdf/ sin auth...');
  const noneRes = await get('https://intranet.helpharma.com/ver-pdf/' + PDF_PATH);
  console.log('   Status:', noneRes.status, '| CT:', noneRes.ct, '| Location:', noneRes.location, '| First bytes:', noneRes.firstBytes);

  // 2. Con Bearer token
  console.log('\n2) GET /ver-pdf/ con Bearer token...');
  const bearerRes = await get('https://intranet.helpharma.com/ver-pdf/' + PDF_PATH + '?bearer=test');
  console.log('   Status:', bearerRes.status, '| CT:', bearerRes.ct);

  // 3. Login y obtener sesión
  console.log('\n3) GET /login (CSRF)...');
  const loginPage = await get('https://intranet.helpharma.com/login');
  console.log('   Status:', loginPage.status, '| Cookies:', loginPage.cookies.length);

  const csrfMatch = loginPage.firstBytes;
  // Buscar CSRF token en los cookies
  const xsrfCookie = loginPage.cookies.find(c => c.startsWith('XSRF-TOKEN='));
  console.log('   XSRF cookie:', xsrfCookie ? xsrfCookie.slice(0, 40) + '...' : 'no encontrado');

  // Necesitamos el _token del HTML — hacer GET completo
  function getBody(url, cookies = '') {
    return new Promise(resolve => {
      const u = new URL(url);
      https.get({ host: u.hostname, path: u.pathname, headers: { Cookie: cookies, 'User-Agent': 'Mozilla/5.0' } }, res => {
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => resolve({ status: res.statusCode, cookies: res.headers['set-cookie'] ?? [], body: Buffer.concat(chunks).toString('utf8') }));
      }).on('error', e => resolve({ error: e.message }));
    });
  }

  const loginFull = await getBody('https://intranet.helpharma.com/login');
  const tokenMatch = loginFull.body.match(/name="_token"\s+value="([^"]+)"/);
  const csrf = tokenMatch ? tokenMatch[1] : null;
  console.log('   CSRF _token:', csrf ? csrf.slice(0, 20) + '...' : 'NO ENCONTRADO');

  if (!csrf) {
    console.log('ERROR: No se pudo obtener el CSRF token');
    process.exit(1);
  }

  const initCookies = parseCookies(loginFull.cookies);
  console.log('   Cookies iniciales:', initCookies.slice(0, 80));

  // 4. POST login
  console.log('\n4) POST /login con credenciales...');
  const loginPost = await post('https://intranet.helpharma.com/login', {
    _token: csrf,
    email: 'usuariomasivo@zentria.com.co',
    password: 'usuariomasivo',
  }, initCookies);

  console.log('   Status:', loginPost.status, '| Location:', loginPost.location);
  console.log('   Nuevas cookies:', loginPost.cookies.length);
  loginPost.cookies.forEach((c, i) => console.log(`   Cookie[${i}]: ${c.slice(0, 120)}`));
  const sessionCookies = parseCookies(loginPost.cookies);
  console.log('   Session cookies (joined):', sessionCookies.slice(0, 200));

  if (loginPost.status !== 302) {
    console.log('WARN: Login no retornó 302 — posiblemente credenciales incorrectas');
  }

  // 5. Usar SOLO las cookies del POST login (sesión autenticada limpia)
  const sessionCookiesOnly = parseCookies(loginPost.cookies);
  console.log('\n5a) Verificando sesión en /intranet...');
  const intranetRes = await get('https://intranet.helpharma.com/intranet', sessionCookiesOnly);
  console.log('   Status:', intranetRes.status, '| CT:', intranetRes.ct, '| Location:', intranetRes.location);

  console.log('\n5b) GET /ver-pdf/ con cookies de POST login (sin mezcla)...');
  const pdfRes = await get('https://intranet.helpharma.com/ver-pdf/' + PDF_PATH, sessionCookiesOnly);
  console.log('   Status:', pdfRes.status, '| CT:', pdfRes.ct, '| Location:', pdfRes.location);
  console.log('   First bytes:', pdfRes.firstBytes, '| Length:', pdfRes.bodyLength);

  // Combinación correcta: init cookies + post cookies (sin duplicar XSRF)
  const allCookies = initCookies + '; ' + sessionCookiesOnly;
  console.log('\n5c) GET /ver-pdf/ con cookies combinadas (init+session)...');
  const pdfRes2 = await get('https://intranet.helpharma.com/ver-pdf/' + PDF_PATH, allCookies);
  console.log('   Status:', pdfRes2.status, '| CT:', pdfRes2.ct, '| Location:', pdfRes2.location);
  console.log('   First bytes:', pdfRes2.firstBytes, '| Length:', pdfRes2.bodyLength);

  if (pdfRes2.status === 302) {
    // Seguir el redirect manualmente
    console.log('\n   Siguiendo redirect a:', pdfRes2.location);
    const pdfFinal = await get(pdfRes2.location, allCookies);
    console.log('   Final status:', pdfFinal.status, '| CT:', pdfFinal.ct);
    console.log('   First bytes:', pdfFinal.firstBytes);
  }

  console.log('\n=== FIN diagnóstico ===');
}

main().catch(console.error);
